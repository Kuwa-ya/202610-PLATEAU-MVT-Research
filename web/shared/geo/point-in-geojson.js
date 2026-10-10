import { pointInRingLonLat } from './point-in-polygon.js';

function ringsFromPolygon(coordinates) {
  if (!coordinates?.length) return [];
  return coordinates.map(ring => ring.map(([lon, lat]) => [lon, lat]));
}

function polygonContainsLonLat(coordinates, lon, lat) {
  const rings = ringsFromPolygon(coordinates);
  if (!rings.length) return false;
  if (!pointInRingLonLat(lon, lat, rings[0])) return false;
  for (let r = 1; r < rings.length; r += 1) {
    if (pointInRingLonLat(lon, lat, rings[r])) return false;
  }
  return true;
}

/** 外環＋穴 — 行政界 PoC 向け */
export function featureContainsLonLat(feature, lon, lat) {
  const geometry = feature.geometry;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return polygonContainsLonLat(geometry.coordinates, lon, lat);
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (polygonContainsLonLat(poly, lon, lat)) return true;
    }
  }
  return false;
}

export function findFeatureContainingPoint(features, lon, lat) {
  for (const feature of features) {
    if (featureContainsLonLat(feature, lon, lat)) return feature;
  }
  return null;
}
