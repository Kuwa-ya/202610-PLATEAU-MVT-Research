/**
 * 経緯度ポリゴン同士の交差判定（MVT footprint・B.4）
 */

import { pointInPolygonLonLat } from './point-in-ring.js';

function segmentIntersectLonLat(a0, a1, b0, b1) {
  const [x1, y1] = a0;
  const [x2, y2] = a1;
  const [x3, y3] = b0;
  const [x4, y4] = b1;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-18) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function ringEdgesIntersect(outerA, outerB) {
  const na = outerA.length;
  const nb = outerB.length;
  if (na < 2 || nb < 2) return false;
  for (let i = 0; i < na; i += 1) {
    const a0 = outerA[i];
    const a1 = outerA[(i + 1) % na];
    for (let j = 0; j < nb; j += 1) {
      const b0 = outerB[j];
      const b1 = outerB[(j + 1) % nb];
      if (segmentIntersectLonLat(a0, a1, b0, b1)) return true;
    }
  }
  return false;
}

/**
 * @param {{ outer: [number, number][], holes?: [number, number][][] }} a
 * @param {{ outer: [number, number][], holes?: [number, number][][] }} b
 */
export function polygonFootprintsOverlapLonLat(a, b) {
  if (!a?.outer?.length || !b?.outer?.length) return false;
  const holesA = a.holes ?? [];
  const holesB = b.holes ?? [];

  for (const [lon, lat] of a.outer) {
    if (pointInPolygonLonLat(lon, lat, b.outer, holesB)) return true;
  }
  for (const [lon, lat] of b.outer) {
    if (pointInPolygonLonLat(lon, lat, a.outer, holesA)) return true;
  }
  return ringEdgesIntersect(a.outer, b.outer);
}

/** @param {import('@mapbox/geojson-types').Geometry | null | undefined} geometry */
export function footprintsFromGeoJsonGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates;
    if (!outer?.length) return [];
    return [{ outer, holes }];
  }
  if (geometry.type === 'MultiPolygon') {
    const out = [];
    for (const poly of geometry.coordinates) {
      const [outer, ...holes] = poly;
      if (outer?.length) out.push({ outer, holes });
    }
    return out;
  }
  return [];
}

export function geoJsonGeometryOverlapsFootprint(geometry, footprint) {
  for (const part of footprintsFromGeoJsonGeometry(geometry)) {
    if (polygonFootprintsOverlapLonLat(part, footprint)) return true;
  }
  return false;
}
