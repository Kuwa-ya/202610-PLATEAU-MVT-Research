import { GEOJSON_BASE } from './config.js';

function walkCoords(node, acc) {
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    const lon = node[0];
    const lat = node[1];
    acc.west = Math.min(acc.west, lon);
    acc.east = Math.max(acc.east, lon);
    acc.south = Math.min(acc.south, lat);
    acc.north = Math.max(acc.north, lat);
    return;
  }
  for (const child of node) walkCoords(child, acc);
}

export function bboxFromGeoJson(geojson) {
  const acc = { north: -Infinity, south: Infinity, west: Infinity, east: -Infinity };
  for (const feature of geojson.features ?? []) {
    if (feature.geometry) walkCoords(feature.geometry.coordinates, acc);
  }
  if (!Number.isFinite(acc.north)) return null;
  return acc;
}

export async function fetchCityBbox(cityCode, prefCode) {
  const pref = prefCode.padStart(2, '0');
  const url = `${GEOJSON_BASE}/${pref}/${cityCode}.json`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const geojson = await response.json();
  return bboxFromGeoJson(geojson);
}
