/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { dedupeRenderedFeaturesById } from '../../../../shared/mvt/rendered-feature-dedup.js';

const CONFIG = Object.freeze({
  dataYear: '2025',
  mvtMinZoom: 16
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
  return dedupeRenderedFeaturesById(features, layerKindFromId);
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
    selectedFeature: null,
    /** 同一 gml_id 重複排除（頂点数最大を残す） */
    dedupeFeaturesById: true,
    featurePickDebug: null
  };
}

export const Model = Object.freeze({
  CONFIG,
  createInitialState,
  geometrySignature,
  layerKindFromId,
  layerId,
  sourceId,
  uniqueRenderedFeatures
});
