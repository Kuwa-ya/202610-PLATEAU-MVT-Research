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

import { tileBounds, tileCenter } from '../geometric/web-mesh-code.js';
import { localPositionToLatLon, toLocalPosition } from '../foundation/local-frame.js';
import {
  LOAD_CONCURRENCY, LOAD_PRIORITY, TILE_NOT_FOUND_CACHE_LIMIT, TILE_NOT_FOUND_TTL_MS
} from '../config.js?v=20260926-4';
import { createTaskScheduler, LruCache } from '../foundation/cache.js';
import { createTileFetchClient, throwForTileResult, TileLoadError } from '../foundation/tile-fetch.js';

const DEM_TILE_SIZE = 256;
export { DEM_TILE_SIZE };
const DEFAULT_CACHE_LIMIT = 64;
const DEM_PARENT_ZOOM_FLOOR = 11;
const IMAGE_PARENT_ZOOM_FLOOR = 11;
const gridTopologyCache = new Map();

function getGridTopology(size) {
  if (gridTopologyCache.has(size)) return gridTopologyCache.get(size);
  const uvs = new Float32Array(size * size * 2);
  for (let row = 0; row < size; row += 1) {
    const v = row / (size - 1);
    for (let column = 0; column < size; column += 1) {
      const u = column / (size - 1);
      const index = row * size + column;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }
  const indices = new Uint32Array((size - 1) * (size - 1) * 6);
  let offset = 0;
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const topLeft = row * size + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + size;
      const bottomRight = bottomLeft + 1;
      indices.set([topLeft, bottomLeft, topRight, bottomRight, topRight, bottomLeft], offset);
      offset += 6;
    }
  }
  const topology = Object.freeze({ uvs, indices });
  gridTopologyCache.set(size, topology);
  return topology;
}

export function createFocusElevationController(options) {
  let sampler = null;
  let timer = null;
  let sequence = 0;
  const getSampler = () => sampler ??= createDemElevationSampler(options.loader);
  async function refresh() {
    const origin = options.getOrigin();
    if (!origin) return;
    const requestSequence = ++sequence;
    const { latitude, longitude } = options.getFocusLatLon();
    try {
      const elevation = await getSampler().sample(latitude, longitude);
      if (requestSequence !== sequence || !options.getOrigin()) return;
      const localY = elevation - (origin.altitude ?? 0);
      if (Number.isFinite(localY)) options.target.y = localY;
    } catch {
      // Keep the previous focus height when DEM sampling fails.
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void refresh(); }, 120);
  }
  function apply() {
    const origin = options.getOrigin();
    if (!origin) return;
    const { latitude, longitude } = localPositionToLatLon(
      options.target.x, options.target.z, origin, options.getZone()
    );
    const localY = sampleDisplayedTerrainLocalY(latitude, longitude, options.getTerrainData());
    if (localY != null && Number.isFinite(localY)) {
      sequence += 1;
      clearTimeout(timer);
      timer = null;
      options.target.y = localY;
    } else schedule();
  }
  return { apply, refresh, schedule };
}

export async function loadTerrainBatch(loader, tiles, options) {
  return (await Promise.all(tiles.map(tile => buildTerrainData(loader, { tile, ...options })))).filter(Boolean);
}

export function summarizeTerrainData(data) {
  const elevationSourceNames = { dem1a_png: 'DEM1A', dem5a_png: 'DEM5A' };
  const elevationZooms = [...new Set(data.flatMap(item => [
    item.elevationSourceZoom, item.fallbackElevationSourceZoom
  ]).filter(Number.isFinite))].sort((a, b) => a - b);
  return {
    textureTileCount: data.reduce((sum, item) => sum + item.texture.tiles.length, 0),
    vertexCount: data.reduce((sum, item) => sum + item.positions.length / 3, 0),
    triangleCount: data.reduce((sum, item) => sum + item.indices.length / 3, 0),
    elevationSources: [...new Set(data.flatMap(item => item.elevationSourceIds))]
      .map(sourceId => elevationSourceNames[sourceId] ?? sourceId),
    elevationZooms,
    flatTileCount: data.filter(item => item.elevationMissing).length,
    zeroFallbackReasons: [...new Set(data
      .filter(item => item.elevationState === 'zeroFallback')
      .map(item => item.elevationFallbackReason)
      .filter(Boolean))],
    elevationMin: Math.min(...data.map(item => item.elevationMin)),
    elevationMax: Math.max(...data.map(item => item.elevationMax)),
    textureZooms: [...new Set(data.map(item => item.texture.actualZoom))].sort((a, b) => a - b)
  };
}

export function createTileLoader({
  cacheLimit = DEFAULT_CACHE_LIMIT,
  onCacheChange,
  scheduler,
  fetchImpl,
  now,
  delay,
  retryDelays,
  bitmapFactory = globalThis.createImageBitmap?.bind(globalThis),
  negativeCacheLimit = TILE_NOT_FOUND_CACHE_LIMIT,
  negativeCacheTtlMs = TILE_NOT_FOUND_TTL_MS
} = {}) {
  const cache = new LruCache(cacheLimit, onCacheChange);
  const decodedElevationCache = new LruCache(cacheLimit);
  const taskScheduler = scheduler ?? createTaskScheduler(LOAD_CONCURRENCY);
  const fetchClient = createTileFetchClient({
    cache,
    scheduler: taskScheduler,
    fetchImpl,
    now,
    delay,
    retryDelays,
    negativeCacheLimit,
    negativeCacheTtlMs
  });

  async function fetchBlobResult(url, key, signal, priority = LOAD_PRIORITY.default) {
    return fetchClient.fetchBlobResult(url, key, signal, priority);
  }

  async function fetchBlob(url, key, signal, priority = LOAD_PRIORITY.default) {
    const result = await fetchBlobResult(url, key, signal, priority);
    return throwForTileResult(result).blob;
  }

  async function loadBitmapResult(url, key, options, signal, priority) {
    const result = await fetchBlobResult(url, key, signal, priority);
    if (result.kind !== 'success') return result;
    signal?.throwIfAborted();
    try {
      if (typeof bitmapFactory !== 'function') throw new Error('画像デコーダーを利用できません。');
      const bitmap = options ? await bitmapFactory(result.blob, options) : await bitmapFactory(result.blob);
      return { ...result, bitmap };
    } catch (error) {
      fetchClient.invalidate(key);
      return {
        kind: signal?.aborted ? 'aborted' : 'transientFailure',
        url: result.url,
        status: result.status,
        attempts: result.attempts,
        phase: 'decode',
        error,
        reason: signal?.aborted ? signal.reason : undefined
      };
    }
  }

  async function loadBitmap(url, key, options, signal, priority) {
    const result = await loadBitmapResult(url, key, options, signal, priority);
    return throwForTileResult(result).bitmap;
  }

  return {
    fetchBlob,
    fetchBlobResult,
    loadBitmap,
    loadBitmapResult,
    invalidate: fetchClient.invalidate,
    cache,
    decodedElevationCache,
    clearNegativeCache: fetchClient.clearNegativeCache,
    getStatus: () => ({
      ...fetchClient.getStatus(),
      ...taskScheduler.getStatus(),
      cacheSize: cache.size,
      cacheLimit,
      decodedSize: decodedElevationCache.size
    })
  };
}

function decodeElevation(red, green, blue) {
  const value = (red << 16) | (green << 8) | blue;
  if (value < 2 ** 23) return value * 0.01;
  if (value === 2 ** 23) return Number.NaN;
  return (value - 2 ** 24) * 0.01;
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像を生成できませんでした。')), type, quality);
  });
}

async function decodeDemTileFromSource(loader, tile, sourceId, signal, priority) {
  signal?.throwIfAborted();
  const cacheKey = `decoded-dem:${sourceId}:${tile.z}/${tile.x}/${tile.y}`;
  const cached = loader.decodedElevationCache?.get(cacheKey);
  if (cached) return cached;

  try {
    const values = await decodeDemTileUncached(loader, tile, sourceId, signal, priority);
    loader.decodedElevationCache?.set(cacheKey, values);
    return values;
  } catch (error) {
    loader.decodedElevationCache?.delete(cacheKey);
    throw error;
  }
}

async function decodeDemTileUncached(loader, tile, sourceId, signal, priority) {
  const url = `https://cyberjapandata.gsi.go.jp/xyz/${sourceId}/${tile.z}/${tile.x}/${tile.y}.png`;
  const blobKey = `dem:${sourceId}:${tile.z}/${tile.x}/${tile.y}`;
  const bitmapResult = await loader.loadBitmapResult(url, blobKey, {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none'
  }, signal, priority);
  const bitmap = throwForTileResult(bitmapResult).bitmap;
  signal?.throwIfAborted();
  try {
    const canvas = createCanvas(DEM_TILE_SIZE, DEM_TILE_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, DEM_TILE_SIZE, DEM_TILE_SIZE).data;
    const values = new Float64Array(DEM_TILE_SIZE * DEM_TILE_SIZE);
    for (let i = 0; i < values.length; i += 1) {
      const offset = i * 4;
      values[i] = decodeElevation(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
    }
    return values;
  } catch (error) {
    loader.invalidate?.(blobKey);
    throw new TileLoadError({
      kind: 'transientFailure', url, status: bitmapResult.status,
      attempts: bitmapResult.attempts, phase: 'decode', error
    });
  } finally {
    bitmap.close();
  }
}

export async function decodeDemTile(loader, tile, signal, priority) {
  if (tile.z <= 14) {
    return {
      values: await decodeDemTileFromSource(loader, tile, 'dem5a_png', signal, priority),
      sourceIds: ['dem5a_png']
    };
  }

  let dem1a;
  let dem1aError;
  try {
    dem1a = await decodeDemTileFromSource(loader, tile, 'dem1a_png', signal, priority);
  } catch (error) {
    dem1aError = error;
    if (!(error instanceof TileLoadError) || error.kind !== 'notFound') throw error;
  }

  // DEM5A is published only through z15. At z16+ its role is handled by the
  // separately sampled z15 fallback, so do not spend three retries on URLs
  // that cannot exist.
  if (tile.z >= 16) {
    if (!dem1a) throw dem1aError;
    return { values: dem1a, sourceIds: ['dem1a_png'] };
  }

  const needsDem5a = !dem1a || dem1a.some(value => !Number.isFinite(value));
  if (!needsDem5a) return { values: dem1a, sourceIds: ['dem1a_png'] };

  let dem5a;
  let dem5aError;
  try {
    dem5a = await decodeDemTileFromSource(loader, tile, 'dem5a_png', signal, priority);
  } catch (error) {
    dem5aError = error;
    if (!(error instanceof TileLoadError) || error.kind !== 'notFound') {
      if (!dem1a || !Number.isFinite(minFinite(dem1a))) throw error;
    }
  }

  if (!dem1a) {
    if (!dem5a) throw dem5aError ?? dem1aError;
    return { values: dem5a, sourceIds: ['dem5a_png'] };
  }
  if (!dem5a) return {
    values: dem1a,
    sourceIds: ['dem1a_png'],
    fallbackFailure: dem5aError ?? null
  };

  const merged = new Float64Array(dem1a);
  let usedDem5a = false;
  for (let index = 0; index < merged.length; index += 1) {
    if (Number.isFinite(merged[index]) || !Number.isFinite(dem5a[index])) continue;
    merged[index] = dem5a[index];
    usedDem5a = true;
  }
  return {
    values: merged,
    sourceIds: usedDem5a ? ['dem1a_png', 'dem5a_png'] : ['dem1a_png']
  };
}

function tilePixel(values, x, y) {
  return values[y * DEM_TILE_SIZE + x];
}

function sampleElevation(values, x, y) {
  const x0 = Math.max(0, Math.min(DEM_TILE_SIZE, Math.floor(x)));
  const y0 = Math.max(0, Math.min(DEM_TILE_SIZE, Math.floor(y)));
  const x1 = Math.min(DEM_TILE_SIZE, x0 + 1);
  const y1 = Math.min(DEM_TILE_SIZE, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const samples = [
    [values[y0 * (DEM_TILE_SIZE + 1) + x0], (1 - tx) * (1 - ty)],
    [values[y0 * (DEM_TILE_SIZE + 1) + x1], tx * (1 - ty)],
    [values[y1 * (DEM_TILE_SIZE + 1) + x0], (1 - tx) * ty],
    [values[y1 * (DEM_TILE_SIZE + 1) + x1], tx * ty]
  ];
  let total = 0;
  let weight = 0;
  for (const [value, sampleWeight] of samples) {
    if (!Number.isFinite(value)) continue;
    total += value * sampleWeight;
    weight += sampleWeight;
  }
  return weight > 0 ? total / weight : Number.NaN;
}

function minFinite(values) {
  if (!values) return Number.NaN;
  let min = Infinity;
  for (const value of values) {
    if (Number.isFinite(value) && value < min) min = value;
  }
  return Number.isFinite(min) ? min : Number.NaN;
}

function averageFinite(values) {
  const samples = values.filter(Number.isFinite);
  if (samples.length === 0) return Number.NaN;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function parentTile(tile) {
  return { z: tile.z - 1, x: Math.floor(tile.x / 2), y: Math.floor(tile.y / 2) };
}

async function lowestElevationByZoomOut(loader, tile, options) {
  let current = tile;
  let elevationZoom = options.elevationZoom;
  let fallbackElevationZoom = options.fallbackElevationZoom;
  const terminalZoom = Math.min(DEM_PARENT_ZOOM_FLOOR, current.z);
  let terminalReason = options.missingReason ?? 'noData';
  while (current.z > terminalZoom) {
    options.signal?.throwIfAborted();
    current = parentTile(current);
    elevationZoom = Math.min(elevationZoom, current.z);
    fallbackElevationZoom = Math.min(fallbackElevationZoom, elevationZoom);
    const sources = await loadElevationSources(loader, current, {
      ...options,
      elevationZoom,
      fallbackElevationZoom
    });
    terminalReason = missingReasonForSources(sources);
    const min = minFinite(sampleElevationGrid(sources, options.gridSize).values);
    if (Number.isFinite(min)) return {
      value: min,
      zeroFallback: false,
      terminalZoom: current.z,
      sourceZoom: sources.primary?.sourceZoom ?? sources.fallback?.sourceZoom ?? current.z,
      sourceIds: [...new Set([
        ...(sources.primary?.sourceIds ?? []),
        ...(sources.fallback?.sourceIds ?? [])
      ])]
    };
  }
  return {
    value: 0,
    zeroFallback: true,
    zeroFallbackReason: terminalReason,
    terminalZoom,
    sourceZoom: null,
    sourceIds: []
  };
}

export async function resolveTileLowestElevation(loader, tile, sampledValues, options) {
  const min = minFinite(sampledValues);
  if (Number.isFinite(min)) return {
    value: min,
    zeroFallback: false,
    terminalZoom: options.elevationZoom,
    sourceZoom: options.elevationZoom,
    sourceIds: []
  };
  return lowestElevationByZoomOut(loader, tile, options);
}

/**
 * 欠損頂点はタイル内の最低標高で埋める。境界は隣接タイルの最低標高との平均。
 * タイルに元データが無い場合の最低標高は、ズームを下げた広域から求める。
 */
function fillMissingGridElevations(values, size, tileMin, neighborMins = {}) {
  const filled = new Float64Array(values);
  const last = size - 1;
  const fallback = Number.isFinite(tileMin) ? tileMin : 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const index = row * size + column;
      if (Number.isFinite(values[index])) continue;
      const onNorth = row === 0;
      const onSouth = row === last;
      const onWest = column === 0;
      const onEast = column === last;
      if (!onNorth && !onSouth && !onWest && !onEast) {
        filled[index] = fallback;
        continue;
      }
      const mins = [tileMin];
      if (onWest) mins.push(neighborMins.west);
      if (onEast) mins.push(neighborMins.east);
      if (onNorth) mins.push(neighborMins.north);
      if (onSouth) mins.push(neighborMins.south);
      if (onNorth && onWest) mins.push(neighborMins.northWest);
      if (onNorth && onEast) mins.push(neighborMins.northEast);
      if (onSouth && onWest) mins.push(neighborMins.southWest);
      if (onSouth && onEast) mins.push(neighborMins.southEast);
      const averaged = averageFinite(mins);
      filled[index] = Number.isFinite(averaged) ? averaged : fallback;
    }
  }
  return filled;
}

/**
 * DEM1A（z17）を主、欠損時はDEM5A（z15）で補完する緯度経度サンプラー。
 * CityGML DEM出力向け。257格子は使わず、タイル内バイリニア＋隣接タイル読込で対応する。
 */
export function createDemElevationSampler(loader, { missingValue = 0 } = {}) {
  const tileCache = new Map();
  const DEM1A_ZOOM = 17;
  const DEM5A_ZOOM = 15;

  async function loadTileValues(sourceId, tile) {
    const key = `${sourceId}:${tile.z}/${tile.x}/${tile.y}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const request = (async () => {
      try {
        return await decodeDemTileFromSource(loader, tile, sourceId, undefined, LOAD_PRIORITY.elevation);
      } catch (error) {
        if (error instanceof TileLoadError && error.kind === 'notFound') return null;
        throw error;
      }
    })().catch(error => {
      tileCache.delete(key);
      throw error;
    });
    tileCache.set(key, request);
    return request;
  }

  function latLonToGlobalPixel(latitude, longitude, zoom) {
    const scale = 2 ** zoom;
    const x = ((longitude + 180) / 360) * scale * DEM_TILE_SIZE;
    const latRad = latitude * Math.PI / 180;
    const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale * DEM_TILE_SIZE;
    return { x, y };
  }

  async function sampleAtZoom(latitude, longitude, zoom, sourceId) {
    const global = latLonToGlobalPixel(latitude, longitude, zoom);
    const tileX = Math.floor(global.x / DEM_TILE_SIZE);
    const tileY = Math.floor(global.y / DEM_TILE_SIZE);
    const localX = global.x - tileX * DEM_TILE_SIZE;
    const localY = global.y - tileY * DEM_TILE_SIZE;
    const values = await loadTileValues(sourceId, { z: zoom, x: tileX, y: tileY });
    if (!values) return Number.NaN;
    const x0 = Math.max(0, Math.min(DEM_TILE_SIZE - 1, Math.floor(localX)));
    const y0 = Math.max(0, Math.min(DEM_TILE_SIZE - 1, Math.floor(localY)));
    const x1 = Math.min(DEM_TILE_SIZE - 1, x0 + 1);
    const y1 = Math.min(DEM_TILE_SIZE - 1, y0 + 1);
    const tx = localX - x0;
    const ty = localY - y0;
    const corners = [
      [values[y0 * DEM_TILE_SIZE + x0], (1 - tx) * (1 - ty)],
      [values[y0 * DEM_TILE_SIZE + x1], tx * (1 - ty)],
      [values[y1 * DEM_TILE_SIZE + x0], (1 - tx) * ty],
      [values[y1 * DEM_TILE_SIZE + x1], tx * ty]
    ];
    let total = 0;
    let weight = 0;
    for (const [value, sampleWeight] of corners) {
      if (!Number.isFinite(value)) continue;
      total += value * sampleWeight;
      weight += sampleWeight;
    }
    return weight > 0 ? total / weight : Number.NaN;
  }

  return {
    async sample(latitude, longitude) {
      const primary = await sampleAtZoom(latitude, longitude, DEM1A_ZOOM, 'dem1a_png');
      if (Number.isFinite(primary)) return primary;
      const fallback = await sampleAtZoom(latitude, longitude, DEM5A_ZOOM, 'dem5a_png');
      return Number.isFinite(fallback) ? fallback : missingValue;
    },
    latLonToGlobalPixel,
    DEM1A_ZOOM
  };
}

async function buildElevationGrid(loader, tile, decodeTile = decodeDemTile, signal, priority) {
  // The center tile is required. Neighbours only supply the extra east/south
  // boundary samples and must not invalidate an otherwise usable center DEM.
  const center = await decodeTile(loader, tile, signal, priority);
  signal?.throwIfAborted();
  const [eastResult, southResult, southEastResult] = await Promise.allSettled([
    decodeTile(loader, { ...tile, x: tile.x + 1 }, signal, priority),
    decodeTile(loader, { ...tile, y: tile.y + 1 }, signal, priority),
    decodeTile(loader, { ...tile, x: tile.x + 1, y: tile.y + 1 }, signal, priority)
  ]);
  signal?.throwIfAborted();
  const east = eastResult.status === 'fulfilled' ? eastResult.value : null;
  const south = southResult.status === 'fulfilled' ? southResult.value : null;
  const southEast = southEastResult.status === 'fulfilled' ? southEastResult.value : null;
  const size = DEM_TILE_SIZE + 1;
  const grid = new Float64Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value;
      if (x < DEM_TILE_SIZE && y < DEM_TILE_SIZE) value = tilePixel(center.values, x, y);
      else if (x === DEM_TILE_SIZE && y < DEM_TILE_SIZE) {
        value = east ? tilePixel(east.values, 0, y) : tilePixel(center.values, DEM_TILE_SIZE - 1, y);
      } else if (x < DEM_TILE_SIZE && y === DEM_TILE_SIZE) {
        value = south ? tilePixel(south.values, x, 0) : tilePixel(center.values, x, DEM_TILE_SIZE - 1);
      } else if (southEast) {
        value = tilePixel(southEast.values, 0, 0);
      } else if (east) {
        value = tilePixel(east.values, 0, DEM_TILE_SIZE - 1);
      } else if (south) {
        value = tilePixel(south.values, DEM_TILE_SIZE - 1, 0);
      } else {
        value = tilePixel(center.values, DEM_TILE_SIZE - 1, DEM_TILE_SIZE - 1);
      }
      grid[y * size + x] = value;
    }
  }
  const sources = [center, east, south, southEast].filter(Boolean);
  const neighborFailures = [eastResult, southResult, southEastResult]
    .filter(result => result.status === 'rejected')
    .map(result => result.reason);
  return {
    values: grid,
    sourceIds: [...new Set(sources.flatMap(source => source.sourceIds))],
    failures: [
      ...sources.map(source => source.fallbackFailure).filter(Boolean),
      ...neighborFailures
    ]
  };
}

function textureSource(type) {
  if (type === 'standard') return { id: 'std', extension: 'png', mimeType: 'image/png' };
  if (type === 'plateau-ortho-2023') {
    return {
      id: 'plateau-ortho-2023',
      extension: 'png',
      mimeType: 'image/png',
      urlTemplate: 'https://tile.plateauview.mlit.go.jp/tiles/plateau-ortho-2023/{z}/{x}/{y}.png'
    };
  }
  return { id: 'seamlessphoto', extension: 'jpg', mimeType: 'image/jpeg' };
}

function childTiles(tile, targetZoom) {
  const difference = targetZoom - tile.z;
  if (difference >= 0) {
    const factor = 2 ** difference;
    const result = [];
    for (let y = 0; y < factor; y += 1) {
      for (let x = 0; x < factor; x += 1) {
        result.push({ z: targetZoom, x: tile.x * factor + x, y: tile.y * factor + y, gridX: x, gridY: y, factor });
      }
    }
    return result;
  }
  const factor = 2 ** -difference;
  return [{
    z: targetZoom,
    x: Math.floor(tile.x / factor),
    y: Math.floor(tile.y / factor),
    factor: 1,
    cropFactor: factor,
    cropX: tile.x % factor,
    cropY: tile.y % factor
  }];
}

async function buildTexture(loader, tile, type, textureZoom, signal, priority) {
  const source = textureSource(type);
  const tiles = childTiles(tile, textureZoom);
  const outputSize = 256 * (tiles[0].factor || 1);
  const canvas = createCanvas(outputSize, outputSize);
  const context = canvas.getContext('2d');

  await Promise.all(tiles.map(async item => {
    const url = source.urlTemplate
      ? source.urlTemplate
          .replace('{z}', String(item.z))
          .replace('{x}', String(item.x))
          .replace('{y}', String(item.y))
      : `https://cyberjapandata.gsi.go.jp/xyz/${source.id}/${item.z}/${item.x}/${item.y}.${source.extension}`;
    const bitmap = await loader.loadBitmap(url, `texture:${source.id}:${item.z}/${item.x}/${item.y}`, undefined, signal, priority);
    try {
      signal?.throwIfAborted();
      if (item.cropFactor) {
        const cropSize = 256 / item.cropFactor;
        context.drawImage(bitmap, item.cropX * cropSize, item.cropY * cropSize, cropSize, cropSize, 0, 0, outputSize, outputSize);
      } else {
        context.drawImage(bitmap, item.gridX * 256, item.gridY * 256);
      }
    } finally {
      bitmap.close();
    }
  }));

  try {
    const blob = await canvasToBlob(canvas, source.mimeType, source.mimeType === 'image/jpeg' ? 0.92 : undefined);
    return {
      bitmap: await createImageBitmap(blob),
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: source.mimeType,
      sourceId: source.id,
      urls: tiles.map(item => `https://cyberjapandata.gsi.go.jp/xyz/${source.id}/${item.z}/${item.x}/${item.y}.${source.extension}`),
      tiles
    };
  } catch (error) {
    throw new TileLoadError({
      kind: 'transientFailure',
      url: `composed:${source.id}:${textureZoom}/${tile.x}/${tile.y}`,
      attempts: 1,
      phase: 'decode',
      error
    });
  }
}

export async function buildTextureWithFallback(loader, tile, type, requestedZoom, signal, priority) {
  let lastError;
  const terminalZoom = Math.min(requestedZoom, IMAGE_PARENT_ZOOM_FLOOR);
  for (let zoom = requestedZoom; zoom >= terminalZoom; zoom -= 1) {
    try {
      const texture = await buildTexture(loader, tile, type, zoom, signal, priority);
      texture.requestedZoom = requestedZoom;
      texture.actualZoom = zoom;
      return texture;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!(error instanceof TileLoadError) || error.kind !== 'notFound') throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function loadElevationSources(loader, tile, {
  elevationZoom, fallbackElevationZoom, signal, priority
}) {
  async function loadElevationAt(sourceZoom, sourceId = null) {
    const factor = 2 ** (tile.z - sourceZoom);
    const sourceTile = {
      z: sourceZoom,
      x: Math.floor(tile.x / factor),
      y: Math.floor(tile.y / factor)
    };
    const decodeTile = sourceId
      ? async (tileLoader, source, requestSignal, requestPriority) => ({
        values: await decodeDemTileFromSource(tileLoader, source, sourceId, requestSignal, requestPriority),
        sourceIds: [sourceId]
      })
      : decodeDemTile;
    const elevationGrid = await buildElevationGrid(loader, sourceTile, decodeTile, signal, priority);
    return {
      values: elevationGrid.values,
      sourceIds: elevationGrid.sourceIds,
      failures: elevationGrid.failures ?? [],
      sourceTile,
      factor,
      childX: tile.x - sourceTile.x * factor,
      childY: tile.y - sourceTile.y * factor,
      sourceZoom
    };
  }

  let primary = null;
  let primaryFailure = null;
  try {
    primary = await loadElevationAt(elevationZoom);
  } catch (error) {
    primaryFailure = error;
    if (!(error instanceof TileLoadError) || error.kind !== 'notFound') throw error;
  }

  const needsSeparateFallback = fallbackElevationZoom < elevationZoom
    && (!primary || primary.values.some(value => !Number.isFinite(value)));
  if (!needsSeparateFallback) return {
    primary, fallback: null, primaryFailure, fallbackFailure: null,
    failures: [...(primary?.failures ?? []), primaryFailure].filter(Boolean)
  };

  let fallback = null;
  let fallbackFailure = null;
  try {
    fallback = await loadElevationAt(fallbackElevationZoom, 'dem5a_png');
  } catch (error) {
    fallbackFailure = error;
    const primaryHasFinite = Number.isFinite(minFinite(primary?.values));
    if (!(error instanceof TileLoadError) || error.kind !== 'notFound') {
      if (!primaryHasFinite) throw error;
    }
  }
  return {
    primary, fallback, primaryFailure, fallbackFailure,
    failures: [
      ...(primary?.failures ?? []),
      ...(fallback?.failures ?? []),
      primaryFailure,
      fallbackFailure
    ].filter(Boolean)
  };
}

function sampleElevationGrid(elevationSources, size) {
  const values = new Float64Array(size * size);
  let usedFallback = false;
  const sampleSource = (source, u, v) => {
    if (!source) return Number.NaN;
    const sourceX = (source.childX + u) / source.factor * DEM_TILE_SIZE;
    const sourceY = (source.childY + v) / source.factor * DEM_TILE_SIZE;
    return sampleElevation(source.values, sourceX, sourceY);
  };
  for (let row = 0; row < size; row += 1) {
    const v = row / (size - 1);
    for (let column = 0; column < size; column += 1) {
      const u = column / (size - 1);
      let elevation = sampleSource(elevationSources.primary, u, v);
      if (!Number.isFinite(elevation)) {
        const fallbackElevation = sampleSource(elevationSources.fallback, u, v);
        if (Number.isFinite(fallbackElevation)) {
          elevation = fallbackElevation;
          usedFallback = true;
        }
      }
      values[row * size + column] = elevation;
    }
  }
  return { values, usedFallback };
}

async function sampleNeighborElevationGrid(loader, tile, options) {
  try {
    const sources = await loadElevationSources(loader, tile, options);
    return {
      values: sampleElevationGrid(sources, options.gridSize).values,
      sources,
      failure: null
    };
  } catch (error) {
    return { values: null, sources: null, failure: error };
  }
}

function missingReasonForSources(sources) {
  if (sources?.primary || sources?.fallback) return 'noData';
  return sources?.failures?.some(error => error instanceof TileLoadError && error.kind === 'notFound')
    ? 'notFound'
    : 'noData';
}

export async function buildTerrainData(loader, options) {
  const {
    tile,
    zone = 9,
    heightScale = 1,
    textureType = 'photo',
    textureZoom = 18,
    elevationZoom = Math.min(tile.z, 17),
    fallbackElevationZoom = Math.min(elevationZoom, 15),
    gridSize = 33,
    signal,
    priority = LOAD_PRIORITY.default
  } = options;
  signal?.throwIfAborted();
  const origin = options.origin ?? { ...tileCenter(tile), altitude: 0 };
  if (gridSize < 2) throw new RangeError('地形グリッドは2以上で指定してください。');
  if (elevationZoom > tile.z) throw new RangeError('標高ソースズームは表示タイルズーム以下で指定してください。');

  const elevationOptions = { elevationZoom, fallbackElevationZoom, signal, priority, gridSize };
  const neighborSpecs = [
    ['west', -1, 0],
    ['east', 1, 0],
    ['north', 0, -1],
    ['south', 0, 1],
    ['northWest', -1, -1],
    ['northEast', 1, -1],
    ['southWest', -1, 1],
    ['southEast', 1, 1]
  ];
  const [elevationResult, textureResult, ...neighborResults] = await Promise.allSettled([
    loadElevationSources(loader, tile, elevationOptions),
    buildTextureWithFallback(loader, tile, textureType, textureZoom, signal, priority),
    ...neighborSpecs.map(([, dx, dy]) => sampleNeighborElevationGrid(
      loader,
      { z: tile.z, x: tile.x + dx, y: tile.y + dy },
      elevationOptions
    ))
  ]);
  if (signal?.aborted) {
    if (textureResult.status === 'fulfilled') textureResult.value.bitmap?.close?.();
    signal.throwIfAborted();
  }
  // Imagery is required for a visible tile. Only confirmed notFound exhausts
  // the parent-image search and removes the tile; operational failures surface.
  if (textureResult.status === 'rejected') {
    if (textureResult.reason instanceof TileLoadError && textureResult.reason.kind === 'notFound') return null;
    throw textureResult.reason;
  }
  if (elevationResult.status === 'rejected') {
    textureResult.value.bitmap?.close?.();
    throw elevationResult.reason;
  }
  const texture = textureResult.value;
  let retainTexture = false;
  try {
  const elevationSources = elevationResult.value;
  const bounds = tileBounds(tile.x, tile.y, tile.z);
  const size = gridSize;
  const positions = new Float32Array(size * size * 3);
  const { uvs, indices } = getGridTopology(size);
  const sampled = sampleElevationGrid(elevationSources, size);
  const elevations = sampled.values;
  const usedFallbackElevation = sampled.usedFallback;
  const neighborGrids = Object.fromEntries(neighborSpecs.map(([name], index) => [
    name,
    neighborResults[index]?.status === 'fulfilled'
      ? neighborResults[index].value
      : { values: null, failure: neighborResults[index]?.reason }
  ]));
  const elevationFailures = [...(elevationSources.failures ?? [])];
  for (const neighbor of Object.values(neighborGrids)) {
    if (neighbor?.failure) elevationFailures.push(neighbor.failure);
  }
  const tileResolution = await resolveTileLowestElevation(loader, tile, elevations, {
    ...elevationOptions,
    missingReason: missingReasonForSources(elevationSources)
  });
  const neighborMinEntries = await Promise.all(neighborSpecs.map(async ([name, dx, dy]) => [
    name,
    await (async () => {
      const neighbor = neighborGrids[name];
      if (neighbor?.failure) {
        if (neighbor.failure?.name === 'AbortError') throw neighbor.failure;
        return Number.NaN;
      }
      try {
        const resolved = await resolveTileLowestElevation(
          loader,
          { z: tile.z, x: tile.x + dx, y: tile.y + dy },
          neighbor?.values,
          {
            ...elevationOptions,
            missingReason: missingReasonForSources(neighbor?.sources)
          }
        );
        return resolved.value;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        return Number.NaN;
      }
    })()
  ]));
  const neighborMins = Object.fromEntries(neighborMinEntries);
  const resolvedElevations = fillMissingGridElevations(elevations, size, tileResolution.value, neighborMins);
  let elevationMin = Infinity;
  let elevationMax = -Infinity;
  for (let row = 0; row < size; row += 1) {
    signal?.throwIfAborted();
    const v = row / (size - 1);
    const latitude = bounds.north + (bounds.south - bounds.north) * v;
    for (let column = 0; column < size; column += 1) {
      const u = column / (size - 1);
      const longitude = bounds.west + (bounds.east - bounds.west) * u;
      const index = row * size + column;
      const resolvedElevation = resolvedElevations[index];
      elevationMin = Math.min(elevationMin, resolvedElevation);
      elevationMax = Math.max(elevationMax, resolvedElevation);
      const point = toLocalPosition(latitude, longitude, resolvedElevation, origin, zone, heightScale);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    }
  }

  const terrainData = {
    tile,
    origin,
    zone,
    heightScale,
    positions,
    uvs,
    indices,
    texture,
    bounds,
    elevationSourceZoom: elevationSources.primary?.sourceZoom
      ?? elevationSources.fallback?.sourceZoom
      ?? tileResolution.sourceZoom,
    fallbackElevationSourceZoom: usedFallbackElevation ? elevationSources.fallback?.sourceZoom ?? null : null,
    elevationSourceIds: [...new Set([
      ...(elevationSources.primary?.sourceIds ?? []),
      ...(usedFallbackElevation ? elevationSources.fallback?.sourceIds ?? [] : []),
      ...(tileResolution.sourceIds ?? [])
    ])],
    elevationMissing: tileResolution.zeroFallback,
    elevationState: tileResolution.zeroFallback ? 'zeroFallback' : 'measured',
    elevationFallbackReason: tileResolution.zeroFallback ? tileResolution.zeroFallbackReason : null,
    elevationTerminalZoom: tileResolution.terminalZoom,
    elevationFailures: elevationFailures.map(error => ({
      kind: error?.kind ?? error?.name ?? 'unknown',
      status: error?.status ?? null,
      url: error?.url ?? null
    })),
    usedFallbackElevation,
    elevationMin,
    elevationMax,
    gridSize
  };
  retainTexture = true;
  return terrainData;
  } finally {
    if (!retainTexture) texture.bitmap?.close?.();
  }
}

function bilinearGridValue(values, size, fu, fv, componentOffset) {
  const x0 = Math.floor(fu);
  const y0 = Math.floor(fv);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = fu - x0;
  const ty = fv - y0;
  const sample = (row, column) => {
    const index = (row * size + column) * 3 + componentOffset;
    return values[index];
  };
  const y00 = sample(y0, x0);
  const y10 = sample(y0, x1);
  const y01 = sample(y1, x0);
  const y11 = sample(y1, x1);
  return (1 - tx) * (1 - ty) * y00
    + tx * (1 - ty) * y10
    + (1 - tx) * ty * y01
    + tx * ty * y11;
}

/** 読み込み済み地形メッシュから注視点のローカルY（標高）をバイリニア補間する。 */
export function sampleDisplayedTerrainLocalY(latitude, longitude, terrainTiles) {
  if (!terrainTiles?.length) return null;
  for (const terrain of terrainTiles) {
    const { bounds, gridSize, positions } = terrain;
    if (latitude > bounds.north || latitude < bounds.south) continue;
    if (longitude < bounds.west || longitude > bounds.east) continue;
    const width = bounds.east - bounds.west;
    const heightSpan = bounds.north - bounds.south;
    if (width <= 0 || heightSpan <= 0) continue;
    const u = (longitude - bounds.west) / width;
    const v = (bounds.north - latitude) / heightSpan;
    const fu = Math.max(0, Math.min(1, u)) * (gridSize - 1);
    const fv = Math.max(0, Math.min(1, v)) * (gridSize - 1);
    return bilinearGridValue(positions, gridSize, fu, fv, 1);
  }
  return null;
}
