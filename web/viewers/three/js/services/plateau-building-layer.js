/*!
 * PLATEAU MVT Research — JavaScript source module
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

import {
  BUILDING_MIN_LOD,
  FEATURE_GEOJSON_PATHS,
  LOAD_PRIORITY
} from '/kuwaya-geo/js/config.js';
import {
  buildingMeshCodesAround,
  createBuildingLoader
} from '/kuwaya-geo/js/domain/features.js';
import { createFeatureGroup, createFeatureLayerController } from '/kuwaya-geo/js/view/feature-layer.js';

/** ちずうつしと同じパス規則（本番 geojson-gzip） */
export const PLATEAU_FEATURE_GEOJSON_ROOT = 'https://geo.kuwa-ya.co.jp/geojson-gzip';

export function configurePlateauFeatureGeoJsonRoot(root = PLATEAU_FEATURE_GEOJSON_ROOT) {
  FEATURE_GEOJSON_PATHS.gzip.root = root;
}

function featureGeometryAdapter(THREE) {
  return {
    triangulatePolygon: (outer, holes) => THREE.ShapeUtils.triangulateShape(
      outer.map(point => new THREE.Vector2(point.x, point.y)),
      holes.map(ring => ring.map(point => new THREE.Vector2(point.x, point.y)))
    )
  };
}

export function createPlateauBuildingLayer(THREE, scene, ui, loadScheduler) {
  configurePlateauFeatureGeoJsonRoot();
  const buildingLoader = createBuildingLoader({
    ...featureGeometryAdapter(THREE),
    scheduler: loadScheduler
  });
  const buildingGroup = createFeatureGroup(THREE, 'PLATEAU buildings');
  scene.add(buildingGroup);

  const statusEl = ui.buildingStatus;
  const setFeatureStatus = (message, error) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error', error);
  };

  return createFeatureLayerController(THREE, {
    dataset: 'bldg',
    group: buildingGroup,
    loader: buildingLoader,
    minLod: BUILDING_MIN_LOD,
    codesAround: buildingMeshCodesAround,
    isVisible: () => ui.toggleBuilding?.getAttribute('aria-pressed') === 'true',
    hiddenMessage: '建物表示はオフです。',
    lodMessage: lod => `LOD ${BUILDING_MIN_LOD}以上で建物を表示します（現在LOD ${lod}）。`,
    loadingMessage: (lod, count) => `LOD ${lod}・建物 ${count}ファイルを読み込み中…`,
    successMessage: ({ detailLevel, fileCount, requestedCount, summary, cache }) =>
      `LOD ${detailLevel}・${fileCount}/${requestedCount}ファイル・建物 ${summary.features.toLocaleString('ja-JP')}件・面 ${summary.faces.toLocaleString('ja-JP')}${summary.skippedFaces ? `・除外面 ${summary.skippedFaces}` : ''}・キャッシュ ${cache.files}件`,
    errorMessage: '建物データの読み込みに失敗しました。移動時に再試行します。',
    loadPriority: (code, codes) =>
      codes.indexOf(code) === 0 ? LOAD_PRIORITY.buildingCenter : LOAD_PRIORITY.buildingRing,
    onStatus: setFeatureStatus
  });
}
