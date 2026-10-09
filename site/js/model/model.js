const CONFIG = Object.freeze({
  dataYear: '2025',
  initialCities: Object.freeze(['13101', '13102']),
  maxCities: 8,
  mvtMinZoom: 14
});

const PLACES = Object.freeze({
  otemachi: Object.freeze({ center: [139.7660, 35.6866], zoom: 15.5 }),
  kanda: Object.freeze({ center: [139.7716, 35.6917], zoom: 15.5 }),
  kasumigaseki: Object.freeze({ center: [139.7507, 35.6732], zoom: 15.5 })
});

function parseCityCodes(value) {
  return [...new Set(String(value ?? '').split(/[\s,、]+/).map(code => code.trim()).filter(Boolean))];
}

function validateCityCodes(value) {
  const cityCodes = parseCityCodes(value);
  if (!cityCodes.length || cityCodes.some(code => !/^\d{5}$/.test(code))) {
    return { valid: false, cityCodes, message: '自治体コードを5桁で入力してください' };
  }
  if (cityCodes.length > CONFIG.maxCities) {
    return { valid: false, cityCodes, message: `自治体コードは${CONFIG.maxCities}件以内で指定してください` };
  }
  return { valid: true, cityCodes, message: '' };
}

function tileJsonUrl(kind, cityCode) {
  const dataset = kind === 'road' ? 'tran-lod1' : 'luse';
  return `https://api.plateauview.mlit.go.jp/datacatalog/mvt/${cityCode}-${dataset}-${CONFIG.dataYear}/tilejson.json`;
}

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
    cityCodes: [...CONFIG.initialCities],
    datasetRevision: 0,
    visibility: { luse: true, road: true, mesh: true, webTile: false },
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
  parseCityCodes,
  sourceId,
  tileJsonUrl,
  uniqueRenderedFeatures,
  validateCityCodes
});

