/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { dedupeRenderedFeaturesById } from '../../../../shared/mvt/rendered-feature-dedup.js';
import { MVT_VIEWER_LAYERS } from '../../../../shared/mvt/viewer-mvt-layers.js';

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

function visibilityFromLayers() {
  const out = { cityBoundary: true, mesh: true, webTile: false };
  for (const layer of MVT_VIEWER_LAYERS) out[layer.kind] = layer.defaultVisible;
  return out;
}

function opacityFromLayers() {
  const out = {};
  for (const layer of MVT_VIEWER_LAYERS) out[layer.kind] = layer.defaultOpacity;
  return out;
}

function createInitialState() {
  return {
    visibility: visibilityFromLayers(),
    opacity: opacityFromLayers(),
    status: { message: '地図を準備中', mode: 'loading' },
    stats: { zoom: null, requests: 0, bytes: 0 },
    viewport: {
      mesh: { digits: 8, codes: [], centerCode: null },
      webTile: { zoom: 0, tiles: [], centerCode: null }
    },
    selectedFeature: null,
    addressSearchStatus: ''
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
