import type { GeoJsonFeatureCollection, GeoJsonGeometry } from './geojson-types.js';

type LonLat = [number, number];

function ringsFromGeometry(geometry: GeoJsonGeometry | null | undefined): LonLat[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as LonLat[][]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as LonLat[][][];
  }
  return [];
}

/** 外環のみ（PoC）。各要素は [lon, lat] の閉じたリング */
export function footprintRings(collection: GeoJsonFeatureCollection): LonLat[][] {
  const rings: LonLat[][] = [];
  for (const feature of collection.features ?? []) {
    const fromGeom = ringsFromGeometry(feature.geometry);
    for (const polygon of fromGeom) {
      const outer = polygon[0];
      if (outer && outer.length >= 3) rings.push(outer);
    }
  }
  return rings;
}
