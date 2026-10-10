import { bldgGeoJsonUrl } from './bldg-url.js';
import { fetchBldgFeatureCollection } from './fetch-geojson.js';
import { buildingsFromCollection } from './geojson-buildings.js';
import { meshBounds11, regionalMesh11 } from './mesh-code.js';
import { canvasToPngBytes, renderBuildingsOblique } from './render-oblique.js';

export type BuildingFrameResult = {
  bytes: Uint8Array;
  meshCode: string;
  featureCount: number;
  ringCount: number;
  geoFetchMs: number;
  renderMs: number;
};

export type BuildingFrameRequest = {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  signal?: AbortSignal;
};

export async function buildBuildingFrame(request: BuildingFrameRequest): Promise<BuildingFrameResult> {
  const { latitude, longitude, width, height, signal } = request;
  const meshCode = regionalMesh11(latitude, longitude);
  const bounds = meshBounds11(meshCode);
  const url = bldgGeoJsonUrl(meshCode);

  const geoStart = performance.now();
  const collection = await fetchBldgFeatureCollection(url, signal);
  const geoFetchMs = performance.now() - geoStart;

  const buildings = buildingsFromCollection(collection);
  const renderStart = performance.now();
  const canvas = renderBuildingsOblique(buildings, {
    width,
    height,
    bounds,
    userLat: latitude,
    userLon: longitude
  });
  const bytes = await canvasToPngBytes(canvas);
  const renderMs = performance.now() - renderStart;

  return {
    bytes,
    meshCode,
    featureCount: collection.features?.length ?? 0,
    ringCount: buildings.length,
    geoFetchMs,
    renderMs
  };
}
