/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

import { VIEW_RENDER_BACKEND } from '../config/defaults.js';
import type { GeoJsonFeatureCollection } from './geojson-types.js';
// @ts-expect-error 共有 geo（JS）
import { footprintIntersectsRingLonLat } from '../../../../../shared/geo/point-in-polygon.js';
import { buildingsFromCollection } from './geojson-buildings.js';
import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import type { UseDistrictHighlight } from './use-district-highlight.js';
import { renderBuildingsObliqueWebGL } from './render-oblique-webgl.js';
import { canvasToPngBytes, renderBuildingsOblique } from './render-oblique.js';

function clipBuildingsToUseDistrict(
  buildings: BuildingVolume[],
  ring: Array<[number, number]>
): BuildingVolume[] {
  const clipped = buildings.filter(b => footprintIntersectsRingLonLat(b.outer, ring));
  return clipped.length ? clipped : buildings;
}

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
  useDistrictHighlight: UseDistrictHighlight | null;
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
    useDistrictHighlight,
    width,
    height
  } = request;

  let buildings = buildingsFromCollection(collection);
  if (useDistrictHighlight?.ring?.length) {
    buildings = clipBuildingsToUseDistrict(buildings, useDistrictHighlight.ring);
  }
  const renderStart = performance.now();
  const renderOpts = {
    width,
    height,
    bounds,
    userLat: latitude,
    userLon: longitude,
    movementBearingDeg,
    useDistrictRing: useDistrictHighlight?.ring
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
