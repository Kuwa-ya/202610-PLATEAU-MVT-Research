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

function uniqueRenderedFeatures(features) {
  const seen = new Set();
  return features.filter(feature => {
    const kind = feature.layer.id.startsWith('luse-') ? 'luse' : 'road';
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
    visibility: { luse: true, road: true, cityBoundary: true, mesh: true, webTile: false },
    opacity: { luse: 0.46, road: 0.58 },
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
  layerId,
  sourceId,
  uniqueRenderedFeatures
});

