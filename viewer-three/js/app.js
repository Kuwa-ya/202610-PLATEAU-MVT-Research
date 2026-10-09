import {
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_LERP_RATE,
  CAMERA_MIN_DISTANCE,
  INITIAL_LOCATION
} from '/kuwaya-geo/js/config.js';
import {
  bindCameraInteractions,
  createCameraController,
  createViewer
} from '/kuwaya-geo/js/view/camera.js';
import { MVT_MAX_CAMERA_DISTANCE } from './mvt-config.js';
import { createMvtController } from './mvt-controller.js';
import {
  bindViewUi,
  readEnabledDatasets,
  setLoading,
  setStatus,
  updateMetadata
} from './view-ui.js';

let THREE;
try {
  THREE = await import('https://unpkg.com/three@0.185.1/build/three.module.js');
} catch {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js');
}

const ui = bindViewUi(document);
setStatus(ui, 'Three.js を読み込み中…');

const canvas = document.getElementById('mvt-canvas');
const { renderer, scene } = createViewer(THREE, canvas, window.devicePixelRatio);
const cameraState = createCameraController(THREE);
const { camera, focusedTarget, focusedSpherical } = cameraState;

focusedSpherical.radius = CAMERA_DEFAULT_DISTANCE;
focusedSpherical.phi = Math.PI / 6;
focusedSpherical.theta = 0;
cameraState.spherical.copy(focusedSpherical);
cameraState.update();

const grid = new THREE.GridHelper(12_000, 60, 0x3d4f47, 0x243029);
grid.position.y = 0.02;
grid.material.transparent = true;
grid.material.opacity = 0.55;
if (Array.isArray(grid.material)) {
  grid.material.forEach(m => {
    m.transparent = true;
    m.opacity = 0.55;
  });
}
scene.add(grid);

const originRef = {
  lat: INITIAL_LOCATION.latitude,
  lon: INITIAL_LOCATION.longitude
};

const mvt = createMvtController(THREE, scene, () => ({
  origin: originRef,
  distance: focusedSpherical.radius,
  target: focusedTarget,
  datasetIds: readEnabledDatasets(ui)
}));

let syncTimer = null;
let syncInflight = 0;

function applyMvtResult(result) {
  const view = result.viewCenter ?? { lat: originRef.lat, lon: originRef.lon };
  let mvtMode = '待機';
  let statusLine = `MVT 待機 — ${Math.round(result.distance)} m（${MVT_MAX_CAMERA_DISTANCE} m 以内で z16）`;
  let hintLine = 'ホイールで寄るか「MVT 表示距離まで寄る」を押してください。';
  let isError = false;

  if (result.mode === 'on') {
    mvtMode = '表示中';
    statusLine = `MVT 表示 — ${result.count} / ${result.planned} タイル`;
    hintLine = result.error || '左ドラッグで移動、ホイールでズーム。';
    isError = Boolean(result.error);
  } else if (result.mode === 'error') {
    mvtMode = 'エラー';
    statusLine = result.error;
    hintLine = 'F12 コンソールと /data/ /vendor/ の応答を確認してください。';
    isError = true;
  } else if (!readEnabledDatasets(ui).length) {
    mvtMode = 'オフ';
    statusLine = '表示レイヤーがすべて非表示です。';
    hintLine = '左パネルで土地利用または道路を「表示」にしてください。';
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
  syncTimer = setTimeout(async () => {
    syncInflight += 1;
    setLoading(ui, true);
    try {
      applyMvtResult(await mvt.sync());
    } catch (error) {
      applyMvtResult({
        mode: 'error',
        distance: focusedSpherical.radius,
        count: 0,
        planned: 0,
        error: error?.message ?? String(error),
        viewCenter: { lat: originRef.lat, lon: originRef.lon }
      });
    } finally {
      syncInflight = Math.max(0, syncInflight - 1);
      if (!syncInflight) setLoading(ui, false);
    }
  }, 180);
}

bindCameraInteractions(THREE, canvas, cameraState, {
  onZoom: scheduleSync,
  onPan: scheduleSync,
  onPanEnd: scheduleSync
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
  scheduleSync();
});

ui.viewZoomMvt?.addEventListener('click', () => {
  focusedSpherical.radius = Math.max(CAMERA_MIN_DISTANCE, MVT_MAX_CAMERA_DISTANCE * 0.75);
  cameraState.update();
  scheduleSync();
});

for (const select of [ui.luseVisibility, ui.tranVisibility]) {
  select?.addEventListener('change', () => {
    mvt.clearTiles();
    scheduleSync();
  });
}

ui.localOrigin.textContent = `${originRef.lat.toFixed(8)}, ${originRef.lon.toFixed(8)}`;
setStatus(ui, '起動完了。カメラを操作するか「MVT 表示距離まで寄る」を試してください。');
scheduleSync();
