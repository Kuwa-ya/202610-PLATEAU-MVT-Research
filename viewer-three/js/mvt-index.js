import { DATA_BASE, MVT_FETCH_ZOOM, MVT_INDEX_ZOOM } from './mvt-config.js';
import { parentKeyForChild, tilesForBounds } from './web-tiles.js';

const manifestCache = new Map();
const parentIndexCache = new Map();

export async function loadManifest(datasetId) {
  if (manifestCache.has(datasetId)) return manifestCache.get(datasetId);
  const url = `${DATA_BASE}/manifest/${datasetId}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`manifest: ${url}`);
  const manifest = await response.json();
  manifest.byCode = new Map(manifest.cities.map(c => [c.cityCode, c]));
  manifestCache.set(datasetId, manifest);
  return manifest;
}

export async function loadParentIndex(datasetId, parentKey) {
  const cacheKey = `${datasetId}:${parentKey}`;
  if (parentIndexCache.has(cacheKey)) return parentIndexCache.get(cacheKey);
  const url = `${DATA_BASE}/index/${datasetId}/${parentKey}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`index: ${url}`);
  const doc = await response.json();
  parentIndexCache.set(cacheKey, doc);
  return doc;
}

export function pickFetchCityCode(codes) {
  if (!codes?.length) return null;
  return [...codes].sort((a, b) => Number(a) - Number(b))[0];
}

function mvtUrlFor(manifest, cityCode, z, x, y) {
  const city = manifest.byCode.get(cityCode);
  if (!city) return null;
  return city.mvtUrlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function sourceLayerFor(manifest, cityCode) {
  return manifest.byCode.get(cityCode)?.sourceLayer ?? null;
}

export async function planFetches(bounds, datasetIds) {
  const childTiles = tilesForBounds(bounds, MVT_FETCH_ZOOM);
  const plans = [];
  const seen = new Set();
  const parentLoads = new Map();

  for (const datasetId of datasetIds) {
    const manifest = await loadManifest(datasetId);
    for (const child of childTiles) {
      const parentKey = parentKeyForChild(child.x, child.y, MVT_FETCH_ZOOM, MVT_INDEX_ZOOM);
      const indexKey = `${datasetId}:${parentKey}`;
      if (!parentLoads.has(indexKey)) {
        parentLoads.set(indexKey, loadParentIndex(datasetId, parentKey).catch(() => null));
      }
    }
  }

  await Promise.all(parentLoads.values());

  for (const datasetId of datasetIds) {
    const manifest = await loadManifest(datasetId);
    for (const child of childTiles) {
      const parentKey = parentKeyForChild(child.x, child.y, MVT_FETCH_ZOOM, MVT_INDEX_ZOOM);
      const indexKey = `${datasetId}:${parentKey}`;
      const indexDoc = await parentLoads.get(indexKey);
      if (!indexDoc) continue;
      const tileKey = `${child.x}/${child.y}`;
      const codes = indexDoc.tiles?.[tileKey];
      if (!Array.isArray(codes) || codes.length === 0) continue;
      const cityCode = pickFetchCityCode(codes);
      const dedupe = `${datasetId}:${MVT_FETCH_ZOOM}/${child.x}/${child.y}:${cityCode}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      plans.push({
        datasetId,
        z: MVT_FETCH_ZOOM,
        x: child.x,
        y: child.y,
        cityCode,
        sourceLayer: sourceLayerFor(manifest, cityCode),
        url: mvtUrlFor(manifest, cityCode, MVT_FETCH_ZOOM, child.x, child.y)
      });
    }
  }
  return plans.filter(p => p.url && p.sourceLayer);
}
