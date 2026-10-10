/*!
 * PLATEAU MVT — 現在地付近の luse ポリゴン（Even G2 / 照会）
 */

import { isLandUseRoad } from './feature-style.js';
import { decodeMvt } from './mvt-decode.js';
import { classifyPolygonRings } from './polygon-rings.js';
import { mvtFeatureVertexCount } from './mvt-feature-dedup.js';
import { latLonToTile, tilePointToLonLat } from './tile-math.js';
import { loadMvtManifest, resolveMvtCityCodes } from '../../viewers/maplibre/js/services/indexed-mvt-protocol.js';

export const LUSE_DATASET_ID = 'luse-2025';

const TILE_FETCH_CONCURRENCY = 4;

function tileUrl(template, z, x, y) {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

function ringToLonLat(ring, tile, extent) {
  const out = [];
  for (const p of ring) {
    out.push(tilePointToLonLat(tile.z, tile.x, tile.y, extent, p.x, p.y));
  }
  if (out.length >= 2) {
    const [lon0, lat0] = out[0];
    const [lonN, latN] = out[out.length - 1];
    if (lon0 === lonN && lat0 === latN) out.pop();
  }
  return out;
}

function tiles3x3(latitude, longitude, zoom) {
  const center = latLonToTile(latitude, longitude, zoom);
  const tiles = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      tiles.push({ z: zoom, x: center.x + dx, y: center.y + dy });
    }
  }
  return tiles;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function lusePartsForTile(tile, manifest, signal, roadsOnly) {
  const cityCodes = await resolveMvtCityCodes(LUSE_DATASET_ID, tile.z, tile.x, tile.y);
  if (!cityCodes.length) return [];
  const entries = manifest.cities.filter(c => cityCodes.includes(c.cityCode));
  const parts = [];
  const seenUrl = new Set();

  for (const entry of entries) {
    const dedupeKey = `${entry.cityCode}:${tile.z}/${tile.x}/${tile.y}`;
    if (seenUrl.has(dedupeKey)) continue;
    seenUrl.add(dedupeKey);

    const url = tileUrl(entry.mvtUrlTemplate, tile.z, tile.x, tile.y);
    const response = await fetch(url, { signal });
    if (!response.ok) continue;
    const { features, extent } = await decodeMvt(await response.arrayBuffer(), entry.sourceLayer);

    for (const feature of features) {
      if (feature.type !== 3) continue;
      const props = feature.properties ?? {};
      if (roadsOnly && !isLandUseRoad(props)) continue;
      const groups = classifyPolygonRings(feature.geometry);
      for (const group of groups) {
        const outer = ringToLonLat(group[0], tile, extent);
        if (outer.length < 3) continue;
        const holes = group.slice(1).map(h => ringToLonLat(h, tile, extent)).filter(h => h.length >= 3);
        parts.push({
          outer,
          holes,
          properties: { ...props },
          vertices: mvtFeatureVertexCount(feature)
        });
      }
    }
  }
  return parts;
}

/**
 * @param {{ signal?: AbortSignal, zoom?: number, roadsOnly?: boolean }} [options]
 * @returns {Promise<Array<{ outer, holes, properties, vertices }>>}
 */
export async function fetchLusePolygonsNear(latitude, longitude, options = {}) {
  const signal = options.signal;
  const zoom = options.zoom ?? 16;
  const roadsOnly = options.roadsOnly === true;
  const tiles = tiles3x3(latitude, longitude, zoom);
  const manifest = await loadMvtManifest(LUSE_DATASET_ID);

  const nested = await mapWithConcurrency(
    tiles,
    TILE_FETCH_CONCURRENCY,
    tile => lusePartsForTile(tile, manifest, signal, roadsOnly)
  );
  return nested.flat();
}

/** G2 道路ドレープ用（道路用地のみ） */
export async function fetchLuseRoadPolygonsNear(latitude, longitude, options = {}) {
  const parts = await fetchLusePolygonsNear(latitude, longitude, { ...options, roadsOnly: true });
  return parts.map(({ outer, holes }) => ({ outer, holes }));
}
