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

export class LruCache {
  constructor(limit = 64, onChange = () => {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('LRU上限は1以上の整数で指定してください。');
    this.limit = limit;
    this.values = new Map();
    this.onChange = onChange;
  }

  get size() { return this.values.size; }
  has(key) { return this.values.has(key); }

  get(key) {
    if (!this.values.has(key)) return undefined;
    const value = this.values.get(key);
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.values.has(key)) this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.limit) this.values.delete(this.values.keys().next().value);
    this.onChange(this.values.size, this.limit);
    return value;
  }

  delete(key) {
    const deleted = this.values.delete(key);
    this.onChange(this.values.size, this.limit);
    return deleted;
  }

  clear() {
    this.values.clear();
    this.onChange(this.values.size, this.limit);
  }
}

export class WeightedLruCache {
  constructor({ entryLimit = Infinity, weightLimit = Infinity, onChange = () => {} } = {}) {
    if (entryLimit < 1 || weightLimit < 1) throw new RangeError('キャッシュ上限は1以上で指定してください。');
    this.entryLimit = entryLimit;
    this.weightLimit = weightLimit;
    this.onChange = onChange;
    this.values = new Map();
    this.weight = 0;
  }

  get size() { return this.values.size; }
  has(key) { return this.values.has(key); }

  get(key) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }

  set(key, value, weight = 0) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError('キャッシュ重みは0以上で指定してください。');
    const existing = this.values.get(key);
    if (existing) {
      this.values.delete(key);
      this.weight -= existing.weight;
    }
    this.values.set(key, { value, weight });
    this.weight += weight;
    while (this.values.size > this.entryLimit || this.weight > this.weightLimit) {
      const oldestKey = this.values.keys().next().value;
      const oldest = this.values.get(oldestKey);
      this.values.delete(oldestKey);
      this.weight -= oldest.weight;
    }
    this.onChange(this.status());
    return value;
  }

  delete(key) {
    const entry = this.values.get(key);
    if (!entry) return false;
    this.values.delete(key);
    this.weight -= entry.weight;
    this.onChange(this.status());
    return true;
  }

  status() {
    return { entries: this.values.size, weight: this.weight, entryLimit: this.entryLimit, weightLimit: this.weightLimit };
  }
}

const DEFAULT_SCHEDULE_PRIORITY = 80;

function normalizeScheduleOptions(signalOrOptions, maybePriority) {
  if (signalOrOptions && typeof signalOrOptions === 'object' && !('aborted' in signalOrOptions)) {
    return {
      signal: signalOrOptions.signal,
      priority: Number.isFinite(signalOrOptions.priority) ? signalOrOptions.priority : DEFAULT_SCHEDULE_PRIORITY
    };
  }
  return {
    signal: signalOrOptions,
    priority: Number.isFinite(maybePriority) ? maybePriority : DEFAULT_SCHEDULE_PRIORITY
  };
}

export function createTaskScheduler(concurrency = 4) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('並列数は1以上の整数で指定してください。');
  let active = 0;
  const waiting = [];

  function abortError(signal) {
    return signal?.reason ?? new DOMException('Aborted', 'AbortError');
  }

  function enqueue(entry) {
    const index = waiting.findIndex(item => item.priority > entry.priority);
    if (index === -1) waiting.push(entry);
    else waiting.splice(index, 0, entry);
  }

  function runNext() {
    while (active < concurrency && waiting.length > 0) {
      const entry = waiting.shift();
      if (entry.signal?.aborted) {
        entry.reject(abortError(entry.signal));
        continue;
      }
      active += 1;
      let result;
      try {
        result = entry.task();
      } catch (error) {
        active -= 1;
        entry.reject(error);
        continue;
      }
      Promise.resolve(result).then(entry.resolve, entry.reject).finally(() => {
        active -= 1;
        runNext();
      });
    }
  }

  return {
    schedule(task, signalOrOptions, maybePriority) {
      const { signal, priority } = normalizeScheduleOptions(signalOrOptions, maybePriority);
      if (signal?.aborted) return Promise.reject(abortError(signal));
      return new Promise((resolve, reject) => {
        enqueue({ task, signal, priority, resolve, reject });
        runNext();
      });
    },
    whenIdle(timeoutMs = 2000) {
      return new Promise(resolve => {
        const started = performance.now();
        const tick = () => {
          if (active === 0 && waiting.length === 0) {
            resolve();
            return;
          }
          if (performance.now() - started >= timeoutMs) {
            resolve();
            return;
          }
          setTimeout(tick, 32);
        };
        tick();
      });
    },
    getStatus: () => ({ active, waiting: waiting.length, concurrency })
  };
}

export function createLatestRequestQueue() {
  let loading = false;
  let sequence = 0;
  let controller = null;
  return {
    begin() {
      controller?.abort();
      controller = new AbortController();
      loading = true;
      return ++sequence;
    },
    isCurrent(value) { return value === sequence; },
    signalFor(value) { return value === sequence ? controller.signal : AbortSignal.abort(); },
    finish(value) {
      if (value !== sequence) return null;
      loading = false;
      return null;
    },
    cancel() { controller?.abort(); controller = null; loading = false; sequence += 1; },
    get loading() { return loading; }
  };
}
