/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

const DEFAULT_RETRY_DELAYS = Object.freeze([300, 900]);

function abortReason(signal) {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}

function isAbort(error, signal) {
  return signal?.aborted || error?.name === 'AbortError';
}

function defaultDelay(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    }, { once: true });
  });
}

function retryAfterMilliseconds(response, now) {
  const value = response.headers?.get?.('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : null;
}

function normalizeUrl(url) {
  try {
    const normalized = new URL(url, globalThis.location?.href);
    normalized.hash = '';
    return normalized.href;
  } catch {
    return String(url);
  }
}

export class TileLoadError extends Error {
  constructor(result) {
    const statusText = result.status ? ` (${result.status})` : '';
    super(`タイルを取得できませんでした${statusText}: ${result.url}`, { cause: result.error });
    this.name = 'TileLoadError';
    this.kind = result.kind;
    this.status = result.status ?? null;
    this.url = result.url;
    this.attempts = result.attempts ?? 0;
    this.result = result;
  }
}

export function throwForTileResult(result) {
  if (result.kind === 'success') return result;
  if (result.kind === 'aborted') throw result.reason ?? abortReason();
  throw new TileLoadError(result);
}

export function createTileFetchClient({
  cache,
  scheduler,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  now = () => Date.now(),
  delay = defaultDelay,
  retryDelays = DEFAULT_RETRY_DELAYS,
  negativeCacheLimit = 1024,
  negativeCacheTtlMs = 5 * 60 * 1000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch実装が必要です。');
  if (!Number.isInteger(negativeCacheLimit) || negativeCacheLimit < 1) {
    throw new RangeError('notFoundキャッシュ上限は1以上の整数で指定してください。');
  }
  if (!Number.isFinite(negativeCacheTtlMs) || negativeCacheTtlMs <= 0) {
    throw new RangeError('notFoundキャッシュTTLは正数で指定してください。');
  }

  const inflight = new Map();
  const negative = new Map();
  const metrics = {
    hits: 0,
    misses: 0,
    success: 0,
    notFound: 0,
    accessError: 0,
    transientFailure: 0,
    aborted: 0,
    retries: 0,
    recovered: 0,
    negativeHits: 0,
    negativeExpired: 0,
    negativeEvictions: 0
  };

  function readNegative(url) {
    const key = normalizeUrl(url);
    const entry = negative.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      negative.delete(key);
      metrics.negativeExpired += 1;
      return null;
    }
    negative.delete(key);
    negative.set(key, entry);
    metrics.negativeHits += 1;
    return { kind: 'notFound', status: entry.status, url: key, attempts: 0, fromCache: true };
  }

  function writeNegative(url, status) {
    const key = normalizeUrl(url);
    negative.delete(key);
    negative.set(key, { status, expiresAt: now() + negativeCacheTtlMs });
    while (negative.size > negativeCacheLimit) {
      negative.delete(negative.keys().next().value);
      metrics.negativeEvictions += 1;
    }
  }

  function result(kind, url, attempts, details = {}) {
    metrics[kind] += 1;
    return { kind, url: normalizeUrl(url), attempts, ...details };
  }

  async function perform(url, signal) {
    const maximumAttempts = retryDelays.length + 1;
    let lastError;
    let lastStatus = null;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, { cache: 'default', mode: 'cors', signal });
        lastStatus = response.status;
        if (response.ok) {
          const blob = await response.blob();
          if (blob.size === 0) {
            lastError = new Error(`空のタイル応答です: ${url}`);
            if (attempt < maximumAttempts) {
              metrics.retries += 1;
              await delay(retryDelays[attempt - 1], signal);
              continue;
            }
          } else {
            if (attempt > 1) metrics.recovered += 1;
            return result('success', url, attempt, { status: response.status, blob });
          }
        } else if (response.status === 404 || response.status === 410) {
          writeNegative(url, response.status);
          return result('notFound', url, attempt, { status: response.status, fromCache: false });
        } else if (response.status === 401 || response.status === 403) {
          return result('accessError', url, attempt, { status: response.status });
        } else if (response.status !== 408 && response.status !== 429 && response.status < 500) {
          return result('accessError', url, attempt, { status: response.status });
        } else {
          lastError = new Error(`HTTP ${response.status}: ${url}`);
          if (attempt < maximumAttempts) {
            const configured = retryDelays[attempt - 1];
            const retryAfter = response.status === 429 ? retryAfterMilliseconds(response, now) : null;
            metrics.retries += 1;
            await delay(retryAfter ?? configured, signal);
            continue;
          }
        }
      } catch (error) {
        if (isAbort(error, signal)) {
          return result('aborted', url, attempt, { reason: abortReason(signal), error });
        }
        lastError = error;
        if (attempt < maximumAttempts) {
          metrics.retries += 1;
          await delay(retryDelays[attempt - 1], signal).catch(waitError => {
            if (isAbort(waitError, signal)) throw waitError;
            throw waitError;
          });
          continue;
        }
      }
      break;
    }
    if (signal?.aborted) return result('aborted', url, maximumAttempts, { reason: abortReason(signal), error: lastError });
    return result('transientFailure', url, maximumAttempts, { status: lastStatus, error: lastError });
  }

  function attachConsumer(entry, signal) {
    if (signal?.aborted) return Promise.resolve({ kind: 'aborted', url: entry.url, attempts: 0, reason: abortReason(signal) });
    entry.consumers += 1;
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', onAbort);
        entry.consumers -= 1;
        if (entry.consumers === 0 && !entry.settled) entry.controller.abort();
        resolve(value);
      };
      const onAbort = () => finish({
        kind: 'aborted', url: entry.url, attempts: 0, reason: abortReason(signal)
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(finish);
    });
  }

  async function fetchBlobResult(url, cacheKey, signal, priority) {
    if (signal?.aborted) {
      return result('aborted', url, 0, { reason: abortReason(signal) });
    }
    const cached = cache?.get(cacheKey);
    if (cached instanceof Blob) {
      metrics.hits += 1;
      return { kind: 'success', url: normalizeUrl(url), status: 200, blob: cached, attempts: 0, fromCache: true };
    }
    const negativeResult = readNegative(url);
    if (negativeResult) {
      metrics.hits += 1;
      return negativeResult;
    }
    const existing = inflight.get(cacheKey);
    if (existing && !existing.controller.signal.aborted) {
      metrics.hits += 1;
      return attachConsumer(existing, signal);
    }
    if (existing) inflight.delete(cacheKey);

    metrics.misses += 1;
    const controller = new AbortController();
    const entry = { url: normalizeUrl(url), controller, consumers: 0, settled: false, promise: null };
    const task = () => perform(url, controller.signal);
    entry.promise = (scheduler ? scheduler.schedule(task, { signal: controller.signal, priority }) : task())
      .catch(error => isAbort(error, controller.signal)
        ? result('aborted', url, 0, { reason: abortReason(controller.signal), error })
        : result('transientFailure', url, 0, { error }))
      .then(fetchResult => {
        entry.settled = true;
        if (inflight.get(cacheKey) === entry) inflight.delete(cacheKey);
        if (fetchResult.kind === 'success') cache?.set(cacheKey, fetchResult.blob);
        return fetchResult;
      });
    inflight.set(cacheKey, entry);
    return attachConsumer(entry, signal);
  }

  return {
    fetchBlobResult,
    invalidate(cacheKey) { cache?.delete(cacheKey); },
    clearNegativeCache() { negative.clear(); },
    getStatus: () => ({
      ...metrics,
      inflight: inflight.size,
      negativeSize: negative.size,
      negativeLimit: negativeCacheLimit,
      negativeTtlMs: negativeCacheTtlMs
    })
  };
}
