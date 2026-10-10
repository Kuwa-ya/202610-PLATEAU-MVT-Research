import { VIEW_RENDER_BACKEND } from '../config/defaults.js';
import type { GeoJsonFeatureCollection } from './geojson-types.js';
import { buildingsFromCollection } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import { renderBuildingsObliqueWebGL } from './render-oblique-webgl.js';
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
  movementBearingDeg: number | null;
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
    movementBearingDeg,
    width,
    height
  } = request;

  const buildings = buildingsFromCollection(collection);
  const renderStart = performance.now();
  const renderOpts = {
    width,
    height,
    bounds,
    userLat: latitude,
    userLon: longitude,
    movementBearingDeg
  };
  const canvas =
    VIEW_RENDER_BACKEND === 'webgl'
      ? renderBuildingsObliqueWebGL(buildings, renderOpts)
      : renderBuildingsOblique(buildings, renderOpts);
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
