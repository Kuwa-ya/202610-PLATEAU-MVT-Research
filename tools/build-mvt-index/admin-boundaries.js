import { readFile } from 'node:fs/promises';

function featureCityCode(feature) {
  const pref = String(feature?.properties?.PREF ?? '').padStart(2, '0');
  const city = String(feature?.properties?.CITY ?? '').padStart(3, '0');
  return /^\d{2}$/.test(pref) && /^\d{3}$/.test(city) ? `${pref}${city}` : null;
}

function coordinateBounds(geometry) {
  const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  const visit = value => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      bounds.west = Math.min(bounds.west, value[0]);
      bounds.east = Math.max(bounds.east, value[0]);
      bounds.south = Math.min(bounds.south, value[1]);
      bounds.north = Math.max(bounds.north, value[1]);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry?.coordinates);
  return Number.isFinite(bounds.west) ? bounds : null;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some(hole => pointInRing(point, hole));
}

function orientation(a, b, c) {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a, b, p) {
  return orientation(a, b, p) === 0
    && p[0] >= Math.min(a[0], b[0]) - 1e-12
    && p[0] <= Math.max(a[0], b[0]) + 1e-12
    && p[1] >= Math.min(a[1], b[1]) - 1e-12
    && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (abC === 0 && onSegment(a, b, c))
    || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a))
    || (cdB === 0 && onSegment(c, d, b));
}

function pointInBounds([x, y], bounds) {
  return x >= bounds.west && x <= bounds.east && y >= bounds.south && y <= bounds.north;
}

function polygonIntersectsBounds(polygon, bounds) {
  const corners = [
    [bounds.west, bounds.south], [bounds.east, bounds.south],
    [bounds.east, bounds.north], [bounds.west, bounds.north]
  ];
  if (corners.some(point => pointInPolygon(point, polygon))) return true;
  const edges = corners.map((point, index) => [point, corners[(index + 1) % corners.length]]);
  for (const ring of polygon) {
    if (ring.some(point => pointInBounds(point, bounds))) return true;
    for (let i = 1; i < ring.length; i += 1) {
      if (edges.some(([a, b]) => segmentsIntersect(ring[i - 1], ring[i], a, b))) return true;
    }
  }
  return false;
}

export function geometryIntersectsBounds(geometry, bounds) {
  if (geometry?.type === 'Polygon') return polygonIntersectsBounds(geometry.coordinates, bounds);
  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon => polygonIntersectsBounds(polygon, bounds));
  }
  return false;
}

export async function loadAdminBoundaries(path) {
  const collection = JSON.parse(await readFile(path, 'utf8'));
  const byCode = new Map();
  for (const feature of collection.features ?? []) {
    const cityCode = featureCityCode(feature);
    const bbox = coordinateBounds(feature.geometry);
    if (cityCode && bbox) byCode.set(cityCode, { cityCode, bbox, geometry: feature.geometry });
  }
  return byCode;
}

/** 京都市 MVT（26100）は政令市一体配信のため、区ポリゴン（26101–26111）で交差判定する */
const KYOTO_CITY_MVT_CODE = '26100';
const KYOTO_WARD_CODES = Object.freeze(
  Array.from({ length: 11 }, (_, index) => `261${String(index + 1).padStart(2, '0')}`)
);

export function adminGeometriesForCityCode(cityCode, adminBoundaries) {
  if (cityCode === KYOTO_CITY_MVT_CODE) {
    return KYOTO_WARD_CODES
      .map(code => adminBoundaries.get(code)?.geometry)
      .filter(Boolean);
  }
  const entry = adminBoundaries.get(cityCode);
  return entry ? [entry.geometry] : [];
}

export function cityTileIntersects(city, tileBoundsGeo, adminBoundaries) {
  const cityBbox = city.bbox;
  if (
    tileBoundsGeo.east < cityBbox.west
    || tileBoundsGeo.west > cityBbox.east
    || tileBoundsGeo.north < cityBbox.south
    || tileBoundsGeo.south > cityBbox.north
  ) {
    return false;
  }
  const geometries = adminGeometriesForCityCode(city.cityCode, adminBoundaries);
  if (geometries.length === 0) return true;
  return geometries.some(geometry => geometryIntersectsBounds(geometry, tileBoundsGeo));
}

export async function loadAdminBoundariesFromPaths(paths) {
  const merged = new Map();
  for (const path of paths) {
    const partial = await loadAdminBoundaries(path);
    for (const [code, entry] of partial) merged.set(code, entry);
  }
  return merged;
}

function mergeBboxes(boxes) {
  const merged = { north: -Infinity, south: Infinity, west: Infinity, east: -Infinity };
  for (const box of boxes) {
    if (!box) continue;
    merged.north = Math.max(merged.north, box.north);
    merged.south = Math.min(merged.south, box.south);
    merged.west = Math.min(merged.west, box.west);
    merged.east = Math.max(merged.east, box.east);
  }
  return Number.isFinite(merged.north) ? merged : null;
}

/** 政令市一体コード（26100）など、ローカル行政界から bbox を補う */
export function bboxFromAdminBoundaries(cityCode, adminBoundaries) {
  if (cityCode === KYOTO_CITY_MVT_CODE) {
    return mergeBboxes(KYOTO_WARD_CODES.map(code => adminBoundaries.get(code)?.bbox));
  }
  return adminBoundaries.get(cityCode)?.bbox ?? null;
}
