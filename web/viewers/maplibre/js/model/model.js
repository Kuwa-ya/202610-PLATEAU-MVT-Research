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

const CONFIG = Object.freeze({
  dataYear: '2025',
  mvtMinZoom: 16
});

const PLACES = Object.freeze({
  otemachi: Object.freeze({ center: [139.7660, 35.6866], zoom: 16.3 }),
  kanda: Object.freeze({ center: [139.7716, 35.6917], zoom: 16.3 }),
  kasumigaseki: Object.freeze({ center: [139.7507, 35.6732], zoom: 16.3 })
});

function sourceId(kind, cityCode) {
  return `plateau-${kind}-${cityCode}`;
}

function layerId(kind, geometry, cityCode) {
  return `${kind}-${geometry}-${cityCode}`;
}

function geometrySignature(feature) {
  if (!feature?.geometry) return '';
  const normalize = value => {
    if (Array.isArray(value)) return value.map(normalize);
    return typeof value === 'number' ? Number(value.toFixed(7)) : value;
  };
  return `${feature.geometry.type}:${JSON.stringify(normalize(feature.geometry.coordinates))}`;
}

function layerKindFromId(layerId) {
  if (layerId.startsWith('luse-')) return 'luse';
  if (layerId.startsWith('useDistrict-')) return 'useDistrict';
  return 'road';
}

function uniqueRenderedFeatures(features) {
  const seen = new Set();
  return features.filter(feature => {
    const kind = layerKindFromId(feature.layer.id);
    const featureId = feature.properties?.gml_id ?? feature.properties?.mvt_id;
    const key = featureId === undefined
      ? `${kind}:${geometrySignature(feature)}`
      : `${kind}:${String(featureId)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createInitialState() {
  return {
    visibility: { luse: true, road: false, useDistrict: false, cityBoundary: true, mesh: true, webTile: false },
    opacity: { luse: 0.46, road: 0.58, useDistrict: 0.38 },
    status: { message: '地図を準備中', mode: 'loading' },
    stats: { zoom: null, requests: 0, bytes: 0 },
    viewport: {
      mesh: { digits: 8, codes: [], centerCode: null },
      webTile: { zoom: 0, tiles: [], centerCode: null }
    },
    selectedFeature: null
  };
}

export const Model = Object.freeze({
  CONFIG,
  PLACES,
  createInitialState,
  geometrySignature,
  layerKindFromId,
  layerId,
  sourceId,
  uniqueRenderedFeatures
});

