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

import { getMvtDataBase } from '../../../../shared/mvt/data-region.js';
import { manifestEntriesForCity } from '../../../../shared/mvt/manifest-cities.js';
import { MVT_FETCH_ZOOM, MVT_INDEX_ZOOM } from './mvt-config.js';
import { parentKeyForChild, tilesForBounds } from './web-tiles.js';

const manifestCache = new Map();
const parentIndexCache = new Map();

export async function loadManifest(datasetId) {
  if (manifestCache.has(datasetId)) return manifestCache.get(datasetId);
  const url = `${getMvtDataBase()}/manifest/${datasetId}.json`;
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
  const url = `${getMvtDataBase()}/index/${datasetId}/${parentKey}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`index: ${url}`);
  const doc = await response.json();
  parentIndexCache.set(cacheKey, doc);
  return doc;
}

export function pickFetchCityCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes)].sort((a, b) => Number(a) - Number(b));
}

function mvtUrlFor(city, z, x, y) {
  if (!city?.mvtUrlTemplate) return null;
  return city.mvtUrlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
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
      for (const cityCode of pickFetchCityCodes(codes)) {
        const entries = manifestEntriesForCity(manifest, cityCode);
        const cities = entries.length ? entries : [manifest.byCode.get(cityCode)].filter(Boolean);
        for (const city of cities) {
          const dedupe = `${datasetId}:${MVT_FETCH_ZOOM}/${child.x}/${child.y}:${cityCode}:${city.sourceLayer}`;
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          const url = mvtUrlFor(city, MVT_FETCH_ZOOM, child.x, child.y);
          if (!url || !city.sourceLayer) continue;
          plans.push({
            datasetId,
            z: MVT_FETCH_ZOOM,
            x: child.x,
            y: child.y,
            cityCode,
            sourceLayer: city.sourceLayer,
            url
          });
        }
      }
    }
  }
  return plans.filter(p => p.url && p.sourceLayer);
}
