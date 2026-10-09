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

import { toLocalPosition } from '../foundation/local-frame.js';
import {
  meshBounds,
  meshCodeFromLatLon as meshCodeForDigits,
  meshCodesAround
} from '../geometric/japan-mesh-code.js';
import { deserializeFeatureCollection, geometryOnlyFeatureCollection, polygonsFromGeometry } from '../geojson/geojson-utils.js';
import { createTaskScheduler, WeightedLruCache } from '../foundation/cache.js';
import {
  BUILDING_DISPLAY_RADIUS, BUILDING_MIN_LOD, FEATURE_GEOJSON_FORMAT, FEATURE_GEOJSON_PATHS,
  LOAD_CONCURRENCY, LOAD_PRIORITY
} from '../config.js';

export { BUILDING_MIN_LOD };

const RETRYABLE_STATUS = new Set([408, 429]);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export const meshCodeFromLatLon = (latitude, longitude) => meshCodeForDigits(latitude, longitude, 11);
export { meshBounds };

export function buildingMeshCodesAround(latitude, longitude, radius = BUILDING_DISPLAY_RADIUS) {
  return meshCodesAround(latitude, longitude, radius, 11);
}

export function buildingMeshCodesForBounds(bounds, limit = Infinity) {
  return snapBoundsToRegionalMeshes(bounds, limit).codes;
}

/** tilesForBounds と同様、対角コーナーの地域メッシュ間を矩形単位で埋める。 */
export function snapBoundsToRegionalMeshes(bounds, limit = Infinity) {
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) return { bounds: null, codes: [] };
  const southWest = meshBounds(meshCodeFromLatLon(bounds.south + 1e-12, bounds.west + 1e-12));
  const northEast = meshBounds(meshCodeFromLatLon(bounds.north - 1e-12, bounds.east - 1e-12));
  const snappedBounds = {
    south: southWest.south,
    west: southWest.west,
    north: northEast.north,
    east: northEast.east
  };
  const { height, width } = southWest;
  const codes = [];
  const seen = new Set();
  outer: for (let latitude = snappedBounds.south + height / 2; latitude < snappedBounds.north; latitude += height) {
    for (let longitude = snappedBounds.west + width / 2; longitude < snappedBounds.east; longitude += width) {
      const code = meshCodeFromLatLon(latitude, longitude);
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
      if (codes.length >= limit) break outer;
    }
  }
  return { bounds: snappedBounds, codes };
}

export function buildingPath(meshCode) {
  return meshDataPath(meshCode, 'bldg');
}

export function meshDataPath(meshCode, dataset, format = FEATURE_GEOJSON_FORMAT) {
  if (!['bldg', 'tran'].includes(dataset)) throw new RangeError(`未対応の地域メッシュデータです: ${dataset}`);
  const setting = FEATURE_GEOJSON_PATHS[format];
  if (!setting) throw new RangeError(`未対応の地物GeoJSON形式です: ${format}`);
  return `${setting.root}/${dataset}/${meshCode.slice(0, 4)}/${meshCode.slice(4, 6)}/${meshCode.slice(6, 8)}/${meshCode}_${dataset}${setting.extension}`;
}

async function readMaybeGzipJson(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('このブラウザはgzip GeoJSONの展開に対応していません。');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function cleanRing(ring) {
  const points = ring.filter(point => Array.isArray(point) && point.length >= 3 && point.slice(0, 3).every(Number.isFinite));
  if (points.length > 1 && points[0].slice(0, 3).every((value, index) => value === points.at(-1)[index])) points.pop();
  return points;
}

function newellNormal(points) {
  const normal = { x: 0, y: 0, z: 0 };
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal;
}

function projectedVector(point, axis) {
  if (axis === 'x') return { x: point.z, y: point.y };
  if (axis === 'y') return { x: point.x, y: point.z };
  return { x: point.x, y: point.y };
}

export function buildBuildingGeometryData(geojson, { origin, zone, triangulatePolygon }) {
  if (typeof triangulatePolygon !== 'function') throw new TypeError('triangulatePolygon関数が必要です。');
  const positions = [];
  const indices = [];
  let featureCount = 0;
  let faceCount = 0;
  let skippedFaceCount = 0;
  const footprintSegments = [];
  for (const feature of geojson?.features ?? []) {
    if (feature?.type !== 'Feature' || !['MultiPolygon', 'Polygon'].includes(feature.geometry?.type)) continue;
    featureCount += 1;
    const featureRings = [];
    const polygons = polygonsFromGeometry(feature.geometry);
    for (const polygon of polygons ?? []) {
      const rings = polygon.map(cleanRing).filter(ring => ring.length >= 3);
      if (rings.length === 0) { skippedFaceCount += 1; continue; }
      const localRings = rings.map(ring => ring.map(([longitude, latitude, elevation]) =>
        toLocalPosition(latitude, longitude, elevation, origin, zone, 1)));
      featureRings.push(...localRings);
      const normal = newellNormal(localRings[0]);
      const magnitude = Math.hypot(normal.x, normal.y, normal.z);
      if (magnitude < 1e-8) { skippedFaceCount += 1; continue; }
      const axis = Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)
        ? 'x' : Math.abs(normal.y) >= Math.abs(normal.z) ? 'y' : 'z';
      const triangles = triangulatePolygon(
        localRings[0].map(point => projectedVector(point, axis)),
        localRings.slice(1).map(ring => ring.map(point => projectedVector(point, axis)))
      );
      const flatPoints = localRings.flat();
      const base = positions.length / 3;
      for (const point of flatPoints) positions.push(point.x, point.y, point.z);
      for (const triangle of triangles) {
        const [a, b, c] = triangle;
        const pa = flatPoints[a], pb = flatPoints[b], pc = flatPoints[c];
        const ab = { x: pb.x - pa.x, y: pb.y - pa.y, z: pb.z - pa.z };
        const ac = { x: pc.x - pa.x, y: pc.y - pa.y, z: pc.z - pa.z };
        const dot = (ab.y * ac.z - ab.z * ac.y) * normal.x
          + (ab.z * ac.x - ab.x * ac.z) * normal.y
          + (ab.x * ac.y - ab.y * ac.x) * normal.z;
        indices.push(base + a, base + (dot >= 0 ? b : c), base + (dot >= 0 ? c : b));
      }
      faceCount += 1;
    }
    const featurePoints = featureRings.flat();
    if (featurePoints.length > 0) {
      const minimumY = Math.min(...featurePoints.map(point => point.y));
      const tolerance = 0.01;
      const edges = new Map();
      const pointKey = point => `${point.x.toFixed(3)},${point.z.toFixed(3)}`;
      for (const ring of featureRings) {
        for (let index = 0; index < ring.length; index += 1) {
          const start = ring[index];
          const end = ring[(index + 1) % ring.length];
          if (Math.abs(start.y - minimumY) > tolerance || Math.abs(end.y - minimumY) > tolerance) continue;
          const firstKey = pointKey(start);
          const secondKey = pointKey(end);
          const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
          if (!edges.has(key)) edges.set(key, { start: { x: start.x, y: 0, z: start.z }, end: { x: end.x, y: 0, z: end.z } });
        }
      }
      footprintSegments.push(...edges.values());
    }
  }
  const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
  return {
    positions: new Float32Array(positions),
    indices: new IndexArray(indices),
    featureCount,
    faceCount,
    skippedFaceCount,
    footprintSegments
  };
}

export function createBuildingLoader({ triangulatePolygon, dataset = 'bldg', cacheLimitFiles = 256, cacheLimitBytes = 32 * 1024 * 1024, concurrency = LOAD_CONCURRENCY, scheduler } = {}) {
  if (typeof triangulatePolygon !== 'function') throw new TypeError('triangulatePolygon関数が必要です。');
  const cache = new WeightedLruCache({ entryLimit: cacheLimitFiles, weightLimit: cacheLimitBytes });
  const taskScheduler = scheduler ?? createTaskScheduler(concurrency);
  async function fetchGeoJson(code, signal) {
    const cached = cache.get(code);
    if (cached) return cached;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(meshDataPath(code, dataset), { signal, cache: 'default' });
        if (response.status === 404) return null;
        if (!response.ok) {
          if (!(RETRYABLE_STATUS.has(response.status) || response.status >= 500) || attempt === 2) throw new Error(`建物GeoJSON取得失敗: HTTP ${response.status}`);
          await delay(250 * 2 ** attempt);
          continue;
        }
        const text = await readMaybeGzipJson(response);
        const value = geometryOnlyFeatureCollection(deserializeFeatureCollection(text));
        cache.set(code, value, new Blob([text]).size);
        return value;
      } catch (error) {
        if (signal?.aborted || attempt === 2 || error instanceof SyntaxError) throw error;
        await delay(250 * 2 ** attempt);
      }
    }
    return null;
  }
  return {
    async load(code, { origin, zone, signal, priority = LOAD_PRIORITY.default }) {
      const geojson = await taskScheduler.schedule(() => fetchGeoJson(code, signal), { signal, priority });
      signal?.throwIfAborted();
      if (!geojson) return null;
      const data = { code, ...buildBuildingGeometryData(geojson, { origin, zone, triangulatePolygon }) };
      signal?.throwIfAborted();
      return data;
    },
    getCacheStatus: () => ({ files: cache.size, bytes: cache.weight })
  };
}
