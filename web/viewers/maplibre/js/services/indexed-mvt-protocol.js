/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

const PROTOCOL_NAME = 'plateau-indexed';
const FETCH_ZOOM = 16;
const INDEX_ZOOM = 12;
import { getMvtDataBase } from '../../../../shared/mvt/data-region.js';
const EMPTY_TILE = new ArrayBuffer(0);

const manifestCache = new Map();
const indexCache = new Map();

export function parseIndexedTileUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== `${PROTOCOL_NAME}:`) throw new Error(`未対応のMVT URLです: ${url}`);
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length !== 4) throw new Error(`MVTタイル番号を解釈できません: ${url}`);
  const cityCode = decodeURIComponent(parts[0]);
  const [z, x, y] = parts.slice(1).map(Number);
  if (![z, x, y].every(Number.isInteger)) throw new Error(`MVTタイル番号が不正です: ${url}`);
  return { datasetId: decodeURIComponent(parsed.hostname), cityCode, z, x, y };
}

export function parentKeyForTile(x, y) {
  const divisor = 2 ** (FETCH_ZOOM - INDEX_ZOOM);
  return `${INDEX_ZOOM}/${Math.floor(x / divisor)}/${Math.floor(y / divisor)}`;
}

export function pickFetchCityCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes)].sort((a, b) => Number(a) - Number(b));
}

export function canonicalFetchTile(z, x, y) {
  if (![z, x, y].every(Number.isInteger) || z < FETCH_ZOOM) return null;
  const divisor = 2 ** (z - FETCH_ZOOM);
  return {
    z: FETCH_ZOOM,
    x: Math.floor(x / divisor),
    y: Math.floor(y / divisor)
  };
}

async function loadCachedJson(cache, key, url, allowMissing = false) {
  if (!cache.has(key)) {
    const request = fetch(url).then(async response => {
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.json();
    });
    cache.set(key, request);
  }
  try {
    return await cache.get(key);
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export async function loadMvtManifest(datasetId) {
  const manifest = await loadCachedJson(
    manifestCache,
    datasetId,
    `${getMvtDataBase()}/manifest/${datasetId}.json`
  );
  if (!manifest.byCode) {
    manifest.byCode = new Map(manifest.cities.map(city => [city.cityCode, city]));
  }
  return manifest;
}

async function loadManifest(datasetId) {
  return loadMvtManifest(datasetId);
}

async function loadIndex(datasetId, parentKey) {
  const key = `${datasetId}:${parentKey}`;
  return loadCachedJson(
    indexCache,
    key,
    `${getMvtDataBase()}/index/${datasetId}/${parentKey}.json`,
    true
  );
}

export async function resolveMvtCityCodes(datasetId, z, x, y) {
  const tile = canonicalFetchTile(z, x, y);
  if (!tile) return [];
  const index = await loadIndex(datasetId, parentKeyForTile(tile.x, tile.y));
  return pickFetchCityCodes(index?.tiles?.[`${tile.x}/${tile.y}`]);
}

async function resolveCityCodes(datasetId, z, x, y) {
  return resolveMvtCityCodes(datasetId, z, x, y);
}

function tileUrl(city, z, x, y) {
  return city.mvtUrlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function emptyTileResponse() {
  return { data: EMPTY_TILE.slice(0) };
}

export function createIndexedMvtProtocol() {
  return {
    name: PROTOCOL_NAME,
    tileTemplate(datasetId, cityCode) {
      return `${PROTOCOL_NAME}://${datasetId}/${cityCode}/{z}/{x}/{y}`;
    },
    loadManifest,
    resolveCityCodes,
    async handler(request, abortController) {
      const { datasetId, cityCode, z, x, y } = parseIndexedTileUrl(request.url);
      if (z !== FETCH_ZOOM) return emptyTileResponse();

      const [manifest, cityCodes] = await Promise.all([
        loadManifest(datasetId),
        resolveCityCodes(datasetId, z, x, y)
      ]);
      const city = cityCodes.includes(cityCode) ? manifest.byCode.get(cityCode) : null;
      if (!city) return emptyTileResponse();

      const response = await fetch(tileUrl(city, z, x, y), {
        signal: abortController?.signal
      });
      if (response.status === 404) return emptyTileResponse();
      if (!response.ok) throw new Error(`${datasetId} ${z}/${x}/${y}: HTTP ${response.status}`);
      return {
        data: await response.arrayBuffer(),
        cacheControl: response.headers.get('cache-control') || undefined,
        expires: response.headers.get('expires') || undefined
      };
    }
  };
}

