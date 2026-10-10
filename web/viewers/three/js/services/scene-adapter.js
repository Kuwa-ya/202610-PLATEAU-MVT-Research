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
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_LERP_RATE,
  CAMERA_MIN_DISTANCE,
  TERRAIN_STREAM_ACTIVE_DELAY,
  TERRAIN_STREAM_DELAY
} from '/kuwaya-geo/js/config.js';
import {
  bindCameraInteractions,
  createCameraController,
  createViewer
} from '/kuwaya-geo/js/view/camera.js';
import { DEFAULT_VIEWER_LOCATION } from '../../../../shared/geo/viewer-defaults.js';
import { MVT_VIEWER_LAYERS } from '../../../../shared/mvt/viewer-mvt-layers.js';
import { applyGeocodeResult, originRefFromTerrain } from './address-navigation.js';
import { MVT_MAX_CAMERA_DISTANCE } from './mvt-config.js';
import { createMvtController } from './mvt-controller.js';
import { createTerrainPoc } from './terrain-poc.js';

export async function createSceneAdapter(viewModel, { canvas, ui, readEnabledDatasets }) {
  const THREE = await import('/vendor/three/three.module.min.js');
  const initialLocation = DEFAULT_VIEWER_LOCATION;

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
    lat: initialLocation.latitude,
    lon: initialLocation.longitude
  };

  function syncOriginFromTerrain() {
    const next = originRefFromTerrain(terrain);
    if (!next) return;
    originRef.lat = next.lat;
    originRef.lon = next.lon;
    viewModel.setOrigin(next.lat, next.lon);
    if (ui.originLatitude) ui.originLatitude.value = String(next.lat);
    if (ui.originLongitude) ui.originLongitude.value = String(next.lon);
    if (ui.originStatus) {
      ui.originStatus.textContent = `固定原点：${next.lat.toFixed(8)}, ${next.lon.toFixed(8)}`;
    }
  }

  viewModel.setOrigin(originRef.lat, originRef.lon);

  let mvtLoading = false;
  let terrainLoading = false;
  let initialMvtLoadPending = true;

  function refreshLoadingOverlay() {
    if (terrainLoading && mvtLoading) {
      viewModel.setLoading(true, '地形・MVT を読み込んでいます');
    } else if (terrainLoading) {
      viewModel.setLoading(true, '地形データを読み込んでいます');
    } else if (mvtLoading) {
      viewModel.setLoading(true, 'MVT を読み込んでいます');
    } else {
      viewModel.setLoading(false);
    }
  }

  const terrainPoc = createTerrainPoc(THREE, {
    scene,
    cameraController: cameraState,
    focusedTarget,
    focusedSpherical,
    ui,
    initialLocation,
    onLoadingChange: active => {
      terrainLoading = active;
      refreshLoadingOverlay();
    },
    onStatus: (message, isError) => viewModel.setStatus(message, isError),
    onTerrainCommitted: () => {
      syncOriginFromTerrain();
      scheduleSync();
    }
  });

  const { terrain } = terrainPoc;

  const mvt = createMvtController(THREE, scene, () => {
    const o = originRefFromTerrain(terrain) ?? originRef;
    return {
      origin: o,
      distance: focusedSpherical.radius,
      target: focusedTarget,
      datasetIds: readEnabledDatasets()
    };
  });

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

    if (!readEnabledDatasets().length) {
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

    const tileCoordLabel = formatLoadedMvtTileCoords(mvt.listLoadedTileKeys());

    viewModel.setMetadata({
      viewLat: view.lat,
      viewLon: view.lon,
      distance: result.distance,
      tileCount: result.count,
      planned: result.planned,
      mvtMode,
      mvtTilesLabel:
        result.mode === 'on'
          ? `${result.count} / ${result.planned}${tileCoordLabel ? ` · z16/${tileCoordLabel}` : ''}`
          : '—',
      statusLine,
      hintLine,
      isError
    });
  }

  function formatLoadedMvtTileCoords(keys) {
    const coords = new Set();
    for (const key of keys) {
      const match = key.match(/:16\/(\d+\/\d+):/);
      if (match) coords.add(match[1]);
    }
    const list = [...coords].sort();
    if (!list.length) return '';
    if (list.length <= 4) return list.join(', ');
    return `${list.slice(0, 3).join(', ')} +${list.length - 3}`;
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

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    cameraState.step(delta, CAMERA_LERP_RATE);
    renderer.render(scene, camera);
  }

  return {
    start() {
      window.addEventListener('resize', resize);
      resize();
      requestAnimationFrame(animate);
      terrainPoc.setVisible(ui.terrainVisibility?.value !== 'hide');
      for (const layer of MVT_VIEWER_LAYERS) {
        mvt.setDatasetOpacity(layer.datasetId, layer.defaultOpacity);
      }
      terrainPoc.initialRequest(true);
      viewModel.setStatus(
        '起動完了。住所検索またはカメラ操作で移動し、900 m 以内で MVT を表示します。'
      );
      scheduleSync();
    },

    getOriginRef() {
      return originRef;
    },

    applyOrigin(lat, lon) {
      mvt.clearTiles();
      terrainPoc.requestAt(lat, lon, true);
      terrainPoc.scheduleStream(80);
      terrainPoc.scheduleLodRefresh();
    },

    goToGeocodeResult(result) {
      const { originRebuilt } = applyGeocodeResult({
        THREE,
        result,
        terrain,
        focusedTarget,
        focusedSpherical,
        requestTerrainAt: (lat, lon, resetFocus) => terrainPoc.requestAt(lat, lon, resetFocus),
        applyFocusElevation: () => terrainPoc.applyFocusElevation(),
        scheduleStream: delay => terrainPoc.scheduleStream(delay),
        scheduleLodRefresh: () => terrainPoc.scheduleLodRefresh(),
        mvtMaxCameraDistance: MVT_MAX_CAMERA_DISTANCE
      });
      if (originRebuilt) {
        mvt.clearTiles();
      } else {
        syncOriginFromTerrain();
      }
      scheduleSync();
    },

    resetView() {
      focusedTarget.set(0, 0, 0);
      cameraState.target.copy(focusedTarget);
      focusedSpherical.radius = CAMERA_DEFAULT_DISTANCE;
      focusedSpherical.phi = Math.PI / 6;
      focusedSpherical.theta = 0;
      cameraState.spherical.copy(focusedSpherical);
      cameraState.update();
      terrainPoc.applyFocusElevation();
      scheduleSync();
    },

    zoomToMvtDistance() {
      focusedSpherical.radius = Math.max(CAMERA_MIN_DISTANCE, MVT_MAX_CAMERA_DISTANCE * 0.75);
      cameraState.update();
      terrainPoc.scheduleLodRefresh();
      scheduleSync();
    },

    setDatasetVisible(datasetId, visible) {
      const hasCachedTiles = mvt.setDatasetVisible(datasetId, visible);
      if (lastMvtResult) {
        applyMvtResult({
          ...lastMvtResult,
          count: mvt.getVisibleTileCount()
        });
      }
      if (visible && !hasCachedTiles) scheduleSync();
    },

    setTerrainVisible(show) {
      terrainPoc.setVisible(show);
      if (show) {
        terrainPoc.reload(false);
      } else {
        const group = terrain.getGroup();
        if (group) group.visible = false;
      }
    },

    reloadTerrain(rebuildOrigin) {
      terrainPoc.reload(rebuildOrigin);
    },

    refreshBuildingVisibility() {
      terrainPoc.refreshBuildingVisibility();
    },

    setDatasetOpacity(datasetId, opacity) {
      mvt.setDatasetOpacity(datasetId, opacity);
    },

  };
}
