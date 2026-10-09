/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

let THREE;
try {
  THREE = await import('https://unpkg.com/three@0.185.1/build/three.module.js');
} catch (primaryError) {
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js');
  } catch (fallbackError) {
    throw new AggregateError([primaryError, fallbackError], 'Three.jsをCDNから読み込めませんでした。');
  }
}

import { toLocalPosition } from './foundation/local-frame.js';
import { createTileLoader } from './domain/terrain.js?v=20260926-4';
import { DISPLAY_LEVELS, settingForDistance } from './foundation/lod.js';
import { BUILDING_MIN_LOD, buildingMeshCodesAround, createBuildingLoader } from './domain/features.js';
import { CITYGML_MESH_LIMITS } from './export/citygml-dem.js?v=20260926-4';
import { createExportController } from './export/controller.js?v=20261002';
import { geocodeAddress } from './foundation/geocode.js';
import { createTaskScheduler } from './foundation/cache.js';
import { bindAccessCount } from './foundation/access-counter.js';
import { bindCameraInteractions, createCameraController, createViewer, updateOverlayLabelScales } from './view/camera.js';
import { createContourController } from './view/contour-controller.js';
import { createFeatureGroup, createFeatureLayerController } from './view/feature-layer.js';
import { createSelectionController } from './view/selection-controller.js?v=20260926-4';
import { displayedTerrainBounds } from './view/selection.js?v=20260926-4';
import { createTerrainController } from './view/terrain-controller.js?v=20260926-4';
import { bindUi, bindUiActions, createAddressSearchController, initializeUi, setStatus as setUiStatus } from './view/ui.js?v=20260926-4';
import {
  CAMERA_LERP_RATE, CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE,
  ACCESS_COUNTER_KEY, ACCESS_COUNTER_URL,
  CONTOUR_EXTRA_INTERVALS, CONTOUR_LEVELS, CONTOUR_MAJOR_COLOR, CONTOUR_MAJOR_EVERY, CONTOUR_MINOR_COLOR,
  CONTOUR_OFFSET_BASE_LOD, CONTOUR_OFFSET_MAX, CONTOUR_OFFSET_MIN, CONTOUR_UPDATE_IDLE_TIMEOUT,
  DISPLAY_RADIUS, INITIAL_LOCATION, LOAD_CONCURRENCY, LOAD_PRIORITY, MAX_EXPORT_TILES, MAX_REGIONAL_MESH_EXPORTS,
  TERRAIN_CACHE_LIMIT, TERRAIN_LOD_DELAY, TERRAIN_STREAM_ACTIVE_DELAY, TERRAIN_STREAM_DELAY,
  TRANSPORT_MIN_LOD
} from './config.js?v=20260926-4';

const elements = bindUi(document);
initializeUi(document, elements, [
  ...CONTOUR_EXTRA_INTERVALS,
  ...CONTOUR_LEVELS.map(level => level.interval)
]);
bindAccessCount(elements.accessCount, { url: ACCESS_COUNTER_URL, key: ACCESS_COUNTER_KEY });
const setStatus = (message, isError = false) => setUiStatus(elements.status, message, isError);
const loadScheduler = createTaskScheduler(LOAD_CONCURRENCY);
const loader = createTileLoader({
  cacheLimit: TERRAIN_CACHE_LIMIT,
  scheduler: loadScheduler,
  onCacheChange: (size, limit) => { elements.cacheStatus.textContent = `メモリキャッシュ ${size} / ${limit}`; }
});
const featureGeometryAdapter = {
  triangulatePolygon: (outer, holes) => THREE.ShapeUtils.triangulateShape(
    outer.map(point => new THREE.Vector2(point.x, point.y)),
    holes.map(ring => ring.map(point => new THREE.Vector2(point.x, point.y)))
  )
};
const buildingLoader = createBuildingLoader({ ...featureGeometryAdapter, scheduler: loadScheduler });
const transportLoader = createBuildingLoader({ ...featureGeometryAdapter, dataset: 'tran', scheduler: loadScheduler });

const { renderer, scene } = createViewer(THREE, elements.canvas, window.devicePixelRatio);
const cameraController = createCameraController(THREE);
const { camera, target, focusedTarget, spherical, focusedSpherical } = cameraController;
const buildingGroup = createFeatureGroup(THREE, 'PLATEAU buildings');
const transportGroup = createFeatureGroup(THREE, 'PLATEAU transportation surfaces');
scene.add(buildingGroup, transportGroup);
const featureStatus = (element, message, error) => {
  element.textContent = message;
  element.classList.toggle('error', error);
};
const buildingLayer = createFeatureLayerController(THREE, {
  dataset: 'bldg', group: buildingGroup, loader: buildingLoader, minLod: BUILDING_MIN_LOD,
  codesAround: buildingMeshCodesAround,
  isVisible: () => elements.buildingVisibility.value === 'show',
  hiddenMessage: '建物表示はオフです。',
  lodMessage: lod => `LOD ${BUILDING_MIN_LOD}以上で建物を表示します（現在LOD ${lod}）。`,
  loadingMessage: (lod, count) => `LOD ${lod}・建物 ${count}ファイルを読み込み中…`,
  successMessage: ({ detailLevel, fileCount, requestedCount, summary, cache }) => `LOD ${detailLevel}・${fileCount}/${requestedCount}ファイル・建物 ${summary.features.toLocaleString('ja-JP')}件・面 ${summary.faces.toLocaleString('ja-JP')}${summary.skippedFaces ? `・除外面 ${summary.skippedFaces}` : ''}・キャッシュ ${cache.files}件`,
  errorMessage: '建物データの読み込みに失敗しました。移動時に再試行します。',
  loadPriority: (code, codes) => codes.indexOf(code) === 0 ? LOAD_PRIORITY.buildingCenter : LOAD_PRIORITY.buildingRing,
  onStatus: (message, error) => featureStatus(elements.buildingStatus, message, error)
});
const transportLayer = createFeatureLayerController(THREE, {
  dataset: 'tran', group: transportGroup, loader: transportLoader, minLod: TRANSPORT_MIN_LOD,
  codesAround: buildingMeshCodesAround,
  isVisible: () => elements.transportVisibility.value === 'show',
  hiddenMessage: '道路表示はオフです。',
  lodMessage: lod => `LOD ${TRANSPORT_MIN_LOD}以上で道路を表示します（現在LOD ${lod}）。`,
  loadingMessage: (lod, count) => `LOD ${lod}・道路 ${count}ファイルを読み込み中…`,
  successMessage: ({ detailLevel, fileCount, requestedCount, summary, cache }) => `LOD ${detailLevel}・${fileCount}/${requestedCount}ファイル・道路 ${summary.features.toLocaleString('ja-JP')}件・高さ0 m・キャッシュ ${cache.files}件`,
  errorMessage: '道路データの読み込みに失敗しました。移動時に再試行します。',
  loadPriority: (code, codes) => codes.indexOf(code) === 0 ? LOAD_PRIORITY.transportCenter : LOAD_PRIORITY.transportRing,
  onStatus: (message, error) => featureStatus(elements.transportStatus, message, error)
});

let contours;
let selectionController;
let exportController;
const terrain = createTerrainController(THREE, {
  loader, scene, elements, cameraController, target, focusedTarget, focusedSpherical,
  buildingLayer, transportLayer,
  initialLocation: INITIAL_LOCATION,
  initialZone: 9,
  displayRadius: DISPLAY_RADIUS,
  lodDelay: TERRAIN_LOD_DELAY,
  getContourIntervalForLod: detailLevel => contours.intervalForLod(detailLevel),
  onTerrainCommitted: () => contours?.scheduleUpdate(),
  onViewChanged: () => selectionController?.updateOutline(),
  onAvailabilityChange: () => exportController?.updateAvailability(),
  onStatus: setStatus
});
contours = createContourController(THREE, {
  document, scene, elements,
  levels: CONTOUR_LEVELS,
  majorEvery: CONTOUR_MAJOR_EVERY,
  minorColor: CONTOUR_MINOR_COLOR,
  majorColor: CONTOUR_MAJOR_COLOR,
  offsetBaseLod: CONTOUR_OFFSET_BASE_LOD,
  offsetMin: CONTOUR_OFFSET_MIN,
  offsetMax: CONTOUR_OFFSET_MAX,
  scheduler: loadScheduler,
  idleTimeout: CONTOUR_UPDATE_IDLE_TIMEOUT,
  getTerrainData: terrain.getData,
  getTerrainSetting: terrain.getSetting,
  onChange: () => exportController?.updateAvailability()
});
exportController = createExportController(THREE, {
  document, scene, elements, loader, buildingLoader, transportLoader, contours,
  initialOrigin: INITIAL_LOCATION,
  displayLevels: DISPLAY_LEVELS,
  cityGmlLimits: CITYGML_MESH_LIMITS,
  maxExportTiles: MAX_EXPORT_TILES,
  maxRegionalMeshes: MAX_REGIONAL_MESH_EXPORTS,
  contourMajorEvery: CONTOUR_MAJOR_EVERY,
  getTerrainData: terrain.getData,
  getTerrainSetting: terrain.getSetting,
  getTerrainOrigin: terrain.getOrigin,
  getZone: terrain.getZone,
  getFocusLatLon: terrain.getFocusLatLon,
  getDisplayedTerrainBounds: () => displayedTerrainBounds(terrain.getData()),
  getSelectionBounds: () => selectionController?.bounds() ?? null,
  onStatus: setStatus
});
selectionController = createSelectionController(THREE, {
  scene, camera, elements,
  maxExportTiles: MAX_EXPORT_TILES,
  maxRegionalMeshes: MAX_REGIONAL_MESH_EXPORTS,
  cityGmlLimits: CITYGML_MESH_LIMITS,
  displayLevels: DISPLAY_LEVELS,
  getTerrainGroup: terrain.getGroup,
  getOrigin: terrain.getOrigin,
  getZone: terrain.getZone,
  getElevation: () => focusedTarget.y,
  getExportSetting: exportController.getSetting,
  getCityGmlLod: () => Number(elements.citygmlDemLod?.value ?? 1),
  onStatus: setStatus,
  onChange: exportController.updateAvailability,
  onSelectionComplete: () => exportController.schedulePreviewRefresh()
});

bindCameraInteractions(THREE, elements.canvas, { focusedTarget, focusedSpherical }, {
  isSelectionPreview: selectionController.isPreviewMode,
  onSelectionPreview: selectionController.preview,
  isSelectionClick: selectionController.isClickMode,
  onSelectionClick: selectionController.select,
  onZoom: terrain.scheduleLodRefresh,
  onPan: () => terrain.scheduleStream(TERRAIN_STREAM_ACTIVE_DELAY),
  onPanEnd: () => terrain.scheduleStream(TERRAIN_STREAM_DELAY)
});
const goToAddressSearch = createAddressSearchController(elements, {
  geocode: geocodeAddress,
  onStatus: setStatus,
  onResult: result => {
    focusedSpherical.radius = THREE.MathUtils.clamp(result.cameraDistance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
    selectionController.clear();
    const currentOrigin = terrain.getOrigin();
    if (currentOrigin) {
      const local = toLocalPosition(result.latitude, result.longitude, 0, currentOrigin, terrain.getZone(), 1);
      focusedTarget.set(local.x, focusedTarget.y, local.z);
      terrain.applyFocusElevation();
      terrain.scheduleStream(80);
      terrain.scheduleLodRefresh();
    } else {
      terrain.request({
        latitude: result.latitude,
        longitude: result.longitude,
        setting: settingForDistance(focusedSpherical.radius),
        automatic: false,
        resetFocus: true
      });
    }
  }
});

bindUiActions(elements, {
  changeTexture: () => terrain.reload(false),
  changeZone: () => terrain.reload(true),
  changeBuildingVisibility: () => {
    const focus = terrain.getFocusLatLon();
    return elements.buildingVisibility.value === 'hide'
      ? buildingLayer.clear('建物表示はオフです。')
      : terrain.requestBuilding(focus.latitude, focus.longitude);
  },
  changeTransportVisibility: () => {
    const focus = terrain.getFocusLatLon();
    return elements.transportVisibility.value === 'hide'
      ? transportLayer.clear('道路表示はオフです。')
      : terrain.requestTransport(focus.latitude, focus.longitude);
  },
  changeContourInterval: () => exportController.schedulePreviewRefresh('dxf'),
  changeContourVisibility: contours.update,
  openPreview: exportController.openPreview,
  changeExportLod: () => {
    selectionController.updateOutline();
    selectionController.updateStatus();
    exportController.schedulePreviewRefresh();
  },
  changeExportUnit: () => exportController.schedulePreviewRefresh(),
  changeCityGmlLod: () => {
    selectionController.updateStatus();
    exportController.schedulePreviewRefresh('citygml-dem');
  },
  applyExportOrigin: exportController.applyOrigin,
  toggleSelection: selectionController.toggle,
  clearSelection: () => {
    selectionController.clear();
    exportController.schedulePreviewRefresh();
  },
  searchAddress: goToAddressSearch,
  cancelPreview: exportController.cancelPreview,
  confirmPreview: exportController.confirmPreview
});

function resizeRenderer() {
  const width = elements.viewer.clientWidth;
  const height = elements.viewer.clientHeight;
  renderer.setSize(width, height, false);
  cameraController.resize(width, height);
}
new ResizeObserver(resizeRenderer).observe(elements.viewer);
const animationClock = new THREE.Clock();
let displayedCameraDistance = '';
renderer.setAnimationLoop(() => {
  cameraController.step(animationClock.getDelta(), CAMERA_LERP_RATE);
  updateOverlayLabelScales(THREE, camera, elements.viewer.clientHeight, [contours.getGroup(), exportController.getPreviewGroup()]);
  const cameraDistance = spherical.radius < 100
    ? `${spherical.radius.toFixed(1)} m`
    : `${Math.round(spherical.radius).toLocaleString('ja-JP')} m`;
  if (cameraDistance !== displayedCameraDistance) {
    elements.cameraDistance.textContent = cameraDistance;
    displayedCameraDistance = cameraDistance;
  }
  renderer.render(scene, camera);
});

resizeRenderer();
cameraController.update();
terrain.request({
  latitude: INITIAL_LOCATION.latitude,
  longitude: INITIAL_LOCATION.longitude,
  setting: settingForDistance(focusedSpherical.radius),
  resetFocus: true
});
