import type { GeoJsonFeatureCollection } from './geojson-types.js';
import { buildingsFromCollection } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import { canvasToPngBytes, renderBuildingsOblique } from './render-oblique.js';

export type BuildingFrameResult = {
  bytes: Uint8Array;
  meshCode: string;
  featureCount: number;
  ringCount: number;
  geoFetchMs: number;
  renderMs: number;
};

export type RenderCachedBldgRequest = {
  meshCode: string;
  collection: GeoJsonFeatureCollection;
  bounds: RegionalMeshBounds;
  latitude: number;
  longitude: number;
  headingDeg: number;
  width: number;
  height: number;
};

export async function renderCachedBldgFrame(request: RenderCachedBldgRequest): Promise<BuildingFrameResult> {
  const {
    meshCode,
    collection,
    bounds,
    latitude,
    longitude,
    headingDeg,
    width,
    height
  } = request;

  const buildings = buildingsFromCollection(collection);
  const renderStart = performance.now();
  const canvas = renderBuildingsOblique(buildings, {
    width,
    height,
    bounds,
    userLat: latitude,
    userLon: longitude,
    headingDeg
  });
  const bytes = await canvasToPngBytes(canvas);
  const renderMs = performance.now() - renderStart;

  return {
    bytes,
    meshCode,
    featureCount: collection.features?.length ?? 0,
    ringCount: buildings.length,
    geoFetchMs: 0,
    renderMs
  };
}
