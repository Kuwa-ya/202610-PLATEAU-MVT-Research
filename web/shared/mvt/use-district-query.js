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

import { decodeMvt } from './mvt-decode.js';
import { latLonToTile, lonLatToTilePoint, MVT_FETCH_ZOOM, tilePointToLonLat } from './tile-math.js';
import { formatUseDistrictSummary, USE_DISTRICT_DATASET_ID } from './use-district.js';
import { loadMvtManifest, resolveMvtCityCodes } from '../../viewers/maplibre/js/services/indexed-mvt-protocol.js';

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      (yi > point.y) !== (yj > point.y)
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(area) * 0.5;
}

function outerRingContainingPoint(feature, point) {
  if (feature.type !== 3 || !feature.geometry?.length) return null;
  for (const ring of feature.geometry) {
    if (ring.length >= 3 && pointInRing(point, ring)) return ring;
  }
  return null;
}

function ringToLonLat(ring, tile, extent) {
  const out = [];
  for (const p of ring) {
    const [lon, lat] = tilePointToLonLat(tile.z, tile.x, tile.y, extent, p.x, p.y);
    out.push([lon, lat]);
  }
  if (out.length >= 2) {
    const [lon0, lat0] = out[0];
    const [lonN, latN] = out[out.length - 1];
    if (lon0 === lonN && lat0 === latN) out.pop();
  }
  return out;
}

function tileUrl(template, z, x, y) {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

/**
 * 現在地（緯度経度）を含む用途地域ポリゴンを MVT から取得する。
 * @returns {Promise<{ properties: Record<string, unknown>, ring: [number, number][], summary: string, sourceLayer: string } | null>}
 */
export async function queryUseDistrictAtLonLat(latitude, longitude, options = {}) {
  const signal = options.signal;
  const tile = latLonToTile(latitude, longitude, MVT_FETCH_ZOOM);
  const cityCodes = await resolveMvtCityCodes(USE_DISTRICT_DATASET_ID, tile.z, tile.x, tile.y);
  if (!cityCodes.length) return null;

  const manifest = await loadMvtManifest(USE_DISTRICT_DATASET_ID);
  const entries = manifest.cities.filter(city => cityCodes.includes(city.cityCode));

  let best = null;

  for (const entry of entries) {
    const url = tileUrl(entry.mvtUrlTemplate, tile.z, tile.x, tile.y);
    const response = await fetch(url, { signal });
    if (!response.ok) continue;
    const { features, extent } = await decodeMvt(await response.arrayBuffer(), entry.sourceLayer);
    const tilePoint = lonLatToTilePoint(longitude, latitude, tile.z, tile.x, tile.y, extent);

    for (const feature of features) {
      const outer = outerRingContainingPoint(feature, tilePoint);
      if (!outer) continue;
      const area = ringArea(outer);
      const candidate = {
        properties: feature.properties ?? {},
        ring: ringToLonLat(outer, tile, extent),
        summary: formatUseDistrictSummary(feature.properties),
        sourceLayer: entry.sourceLayer,
        area
      };
      if (!best || area < best.area) best = candidate;
    }
  }

  if (!best) return null;
  return {
    properties: best.properties,
    ring: best.ring,
    summary: best.summary,
    sourceLayer: best.sourceLayer
  };
}
