import {
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_LERP_RATE,
  CAMERA_MIN_DISTANCE,
  TERRAIN_STREAM_ACTIVE_DELAY,
  TERRAIN_STREAM_DELAY
} from '/kuwaya-geo/js/config.js';
import { DEFAULT_VIEWER_LOCATION } from '../../../shared/geo/viewer-defaults.js';

const INITIAL_LOCATION = DEFAULT_VIEWER_LOCATION;
import {
  bindCameraInteractions,
  createCameraController,
  createViewer
} from '/kuwaya-geo/js/view/camera.js';
import { MVT_MAX_CAMERA_DISTANCE } from './mvt-config.js';
import { createMvtController } from './mvt-controller.js';
import { createTerrainPoc } from './terrain-poc.js';
import {
  bindViewUi,
  readEnabledDatasets,
  setLoading,
  setStatus,
  updateMetadata
} from './view-ui.js';

const THREE = await import('/vendor/three/three.module.min.js');

const ui = bindViewUi(document);
setStatus(ui, 'Three.js を読み込み中…');

const canvas = document.getElementById('mvt-canvas');
const { renderer, scene } = createViewer(THREE, canvas, window.devicePixelRatio);
renderer.localClippingEnabled = true;
const cameraState = createCameraController(THREE);
const { camera, focusedTarget, focusedSpherical } = cameraState;

focusedSpherical.radius = CAMERA_DEFAULT_DISTANCE;
focusedSpherical.phi = Math.PI / 6;
focusedSpherical.theta = 0;
cameraState.spherical.copy(focusedSpherical);
cameraState.update();

const originRef = {
  lat: INITIAL_LOCATION.latitude,
  lon: INITIAL_LOCATION.longitude
};

let mvtLoading = false;
let terrainLoading = false;
let initialMvtLoadPending = true;

function refreshLoadingOverlay() {
  if (terrainLoading && mvtLoading) {
    setLoading(ui, true, '地形・MVT を読み込んでいます');
  } else if (terrainLoading) {
    setLoading(ui, true, '地形データを読み込んでいます');
  } else if (mvtLoading) {
    setLoading(ui, true, 'MVT を読み込んでいます');
  } else {
    setLoading(ui, false);
  }
}

const terrainPoc = createTerrainPoc(THREE, {
  scene,
  cameraController: cameraState,
  focusedTarget,
  focusedSpherical,
  ui,
  initialLocation: INITIAL_LOCATION,
  onLoadingChange: active => {
    terrainLoading = active;
    refreshLoadingOverlay();
  },
  onStatus: (message, isError) => setStatus(ui, message, isError)
});

const mvt = createMvtController(THREE, scene, () => ({
  origin: originRef,
  distance: focusedSpherical.radius,
  target: focusedTarget,
  datasetIds: readEnabledDatasets(ui)
}));

let syncTimer = null;
let syncRequestId = 0;
let lastMvtResult = null;

function applyMvtResult(result) {
  lastMvtResult = result;
  const view = result.viewCenter ?? { lat: originRef.lat, lon: originRef.lon };
  let mvtMode = '待機';
  let statusLine = `MVT 待機 — ${Math.round(result.distance)} m（${MVT_MAX_CAMERA_DISTANCE} m 以内で z16）`;
  let hintLine = 'ホイールで寄るか「MVT 表示距離まで寄る」を押してください。';
  let isError = false;

  if (!readEnabledDatasets(ui).length) {
    mvtMode = 'オフ';
    statusLine = '表示レイヤーがすべて非表示です。';
    hintLine = '左パネルで土地利用または道路を「表示」にしてください。';
  } else if (result.mode === 'on') {
    mvtMode = '表示中';
    statusLine = `MVT 表示 — ${result.count} / ${result.planned} タイル`;
    hintLine = result.error || '左ドラッグで移動、ホイールでズーム。';
    isError = Boolean(result.error);
  } else if (result.mode === 'error') {
    mvtMode = 'エラー';
    statusLine = result.error;
    hintLine = 'F12 コンソールと /data/ /vendor/ の応答を確認してください。';
    isError = true;
  }

  updateMetadata(ui, {
    viewLat: view.lat,
    viewLon: view.lon,
    distance: result.distance,
    tileCount: result.count,
    planned: result.planned,
    origin: originRef,
    mvtMode,
    mvtTilesLabel: result.mode === 'on' ? `${result.count} / ${result.planned}` : '—',
    statusLine,
    hintLine,
    isError
  });
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  const requestId = ++syncRequestId;
  syncTimer = setTimeout(async () => {
    const showMvtLoading = initialMvtLoadPending;
    if (showMvtLoading) {
      mvtLoading = true;
      refreshLoadingOverlay();
    }
    try {
      const result = await mvt.sync();
      if (requestId === syncRequestId && !result.stale) applyMvtResult(result);
    } catch (error) {
      if (requestId === syncRequestId) {
        applyMvtResult({
          mode: 'error',
          distance: focusedSpherical.radius,
          count: 0,
          planned: 0,
          error: error?.message ?? String(error),
          viewCenter: { lat: originRef.lat, lon: originRef.lon }
        });
      }
    } finally {
      if (requestId === syncRequestId && showMvtLoading) {
        initialMvtLoadPending = false;
        mvtLoading = false;
        refreshLoadingOverlay();
      }
    }
  }, 280);
}

const { terrain } = terrainPoc;

bindCameraInteractions(THREE, canvas, cameraState, {
  onZoom: () => {
    terrainPoc.scheduleLodRefresh();
    scheduleSync();
  },
  onPan: () => {
    terrainPoc.applyFocusElevation();
    terrainPoc.scheduleStream(TERRAIN_STREAM_ACTIVE_DELAY);
    scheduleSync();
  },
  onPanEnd: () => {
    terrainPoc.scheduleStream(TERRAIN_STREAM_DELAY);
    scheduleSync();
  }
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  cameraState.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  cameraState.step(delta, CAMERA_LERP_RATE);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

ui.originApply?.addEventListener('click', () => {
  const lat = Number(ui.originLatitude?.value);
  const lon = Number(ui.originLongitude?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    ui.originStatus.textContent = '緯度・経度を正しく入力してください。';
    return;
  }
  originRef.lat = lat;
  originRef.lon = lon;
  ui.originStatus.textContent = `固定原点：${lat.toFixed(8)}, ${lon.toFixed(8)}`;
  mvt.clearTiles();
  terrainPoc.reload(true);
  scheduleSync();
});

ui.viewReset?.addEventListener('click', () => {
  focusedTarget.set(0, 0, 0);
  cameraState.target.copy(focusedTarget);
  focusedSpherical.radius = CAMERA_DEFAULT_DISTANCE;
  focusedSpherical.phi = Math.PI / 6;
  focusedSpherical.theta = 0;
  cameraState.spherical.copy(focusedSpherical);
  cameraState.update();
  terrainPoc.applyFocusElevation();
  scheduleSync();
});

ui.viewZoomMvt?.addEventListener('click', () => {
  focusedSpherical.radius = Math.max(CAMERA_MIN_DISTANCE, MVT_MAX_CAMERA_DISTANCE * 0.75);
  cameraState.update();
  terrainPoc.scheduleLodRefresh();
  scheduleSync();
});

for (const [select, datasetId] of [
  [ui.luseVisibility, 'luse-2025'],
  [ui.tranVisibility, 'tran-lod1-2025']
]) {
  select?.addEventListener('change', () => {
    const visible = select.value !== 'hide';
    const hasCachedTiles = mvt.setDatasetVisible(datasetId, visible);
    if (lastMvtResult) {
      applyMvtResult({
        ...lastMvtResult,
        count: mvt.getVisibleTileCount()
      });
    }
    // Showing an already loaded layer is a render-only operation. Fetch only if
    // its cache was invalidated while the layer was hidden or it has not loaded yet.
    if (visible && !hasCachedTiles) scheduleSync();
  });
}

ui.terrainVisibility?.addEventListener('change', () => {
  const show = ui.terrainVisibility.value !== 'hide';
  terrainPoc.setVisible(show);
  if (show) {
    terrainPoc.reload(false);
  } else {
    const group = terrain.getGroup();
    if (group) group.visible = false;
  }
});

ui.textureType?.addEventListener('change', () => terrainPoc.reload(false));
ui.jprcZone?.addEventListener('change', () => terrainPoc.reload(true));

ui.localOrigin.textContent = `${originRef.lat.toFixed(8)}, ${originRef.lon.toFixed(8)}`;
terrainPoc.setVisible(ui.terrainVisibility?.value !== 'hide');
terrainPoc.initialRequest(true);

setStatus(ui, '起動完了。地形の読み込み後、カメラを操作するか「MVT 表示距離まで寄る」を試してください。');
scheduleSync();
