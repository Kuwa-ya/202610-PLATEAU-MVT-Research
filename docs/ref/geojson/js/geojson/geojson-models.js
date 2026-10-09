/* Browser-side GeoJSON models. Corresponds to GeoJson/GeoJsonModels.cs. */
export function createGeometry(type = null, coordinates = null) { return { type, coordinates }; }
export function createFeature({ geometry = null, properties = {}, id } = {}) {
  const feature = { type: 'Feature', geometry, properties };
  if (id !== undefined) feature.id = id;
  return feature;
}
export function createFeatureCollection(features = []) { return { type: 'FeatureCollection', features }; }
export function isGeometry(value) {
  return value != null && typeof value === 'object' && typeof value.type === 'string' && 'coordinates' in value;
}
export function isFeature(value) { return value?.type === 'Feature' && (value.geometry === null || isGeometry(value.geometry)); }
export function isFeatureCollection(value) { return value?.type === 'FeatureCollection' && Array.isArray(value.features); }
