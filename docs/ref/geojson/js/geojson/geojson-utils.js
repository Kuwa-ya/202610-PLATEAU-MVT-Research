import { createFeature, createFeatureCollection, createGeometry, isFeature, isFeatureCollection } from './geojson-models.js';
export function deserializeFeatureCollection(json) {
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isFeatureCollection(value)) throw new TypeError('GeoJSON FeatureCollectionではありません。');
  return value;
}
export function cloneFeatureCollection(collection) { return structuredClone(collection); }
export function geometryOnlyFeatureCollection(collection) {
  return createFeatureCollection((collection.features ?? []).filter(isFeature).map(feature => createFeature({ geometry: feature.geometry })));
}
export function geometryFromCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 4) return null;
  const ring = coordinates.map(point => [...point]);
  const first = ring[0]; const last = ring.at(-1);
  if (!(first.length === last.length && first.every((value, index) => value === last[index]))) ring.push([...first]);
  return createGeometry('Polygon', [ring]);
}
export function featureFromCoordinates(coordinates) {
  const geometry = geometryFromCoordinates(coordinates);
  return geometry ? createFeature({ geometry }) : null;
}
export function polygonsFromGeometry(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
