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

import { CONTOUR_LEVELS, DISPLAY_RADIUS, LOAD_CONCURRENCY, TERRAIN_CACHE_LIMIT, TERRAIN_LOD_DELAY } from '/kuwaya-geo/js/config.js';
import { createTaskScheduler } from '/kuwaya-geo/js/foundation/cache.js';
import { settingForDistance } from '/kuwaya-geo/js/foundation/lod.js';
import { createTileLoader } from '/kuwaya-geo/js/domain/terrain.js';
import { createTerrainController } from '/kuwaya-geo/js/view/terrain-controller.js';
import { createPlateauBuildingLayer } from './plateau-building-layer.js';

const noopFeatureLayer = {
  request: async () => {},
  clear: () => {}
};

function stubSelect(value, optionValues) {
  return {
    value,
    options: optionValues.map(v => ({ value: v, textContent: String(v) })),
    customSelectOptions: null,
    customSelectUpdate: null
  };
}

function contourIntervalForLod(detailLevel) {
  const level = CONTOUR_LEVELS.find(item => detailLevel >= item.minLod);
  return level?.interval ?? 10;
}

/** ちずうつし terrain-controller 向けの DOM（PoC 用に実要素＋スタブを合成） */
export function buildTerrainControllerElements(ui) {
  const loadingStub = {};
  return {
    elements: {
      textureType: ui.textureType,
      zone: ui.jprcZone,
      loading: loadingStub,
      download: { disabled: true },
      exportLod: stubSelect('current', ['current']),
      contourInterval: stubSelect('auto', ['auto']),
      requestedLod: ui.requestedLod,
      viewerRequestedLod: ui.viewerRequestedLod,
      viewerRequestedRow: ui.viewerRequestedRow,
      centerTile: ui.centerTile,
      currentLatitude: ui.currentLatitude,
      currentLongitude: ui.currentLongitude,
      demTile: ui.demTile,
      viewerCurrentLod: ui.viewerCurrentLod,
      textureTiles: ui.textureTiles,
      localOrigin: ui.localOrigin,
      vertexCount: ui.vertexCount,
      cacheStatus: ui.cacheStatus
    },
    loadingStub
  };
}

export function createTerrainPoc(THREE, options) {
  const {
    scene,
    cameraController,
    focusedTarget,
    focusedSpherical,
    ui,
    initialLocation,
    onLoadingChange,
    onStatus
  } = options;

  const { elements, loadingStub } = buildTerrainControllerElements(ui);
  const loadScheduler = createTaskScheduler(LOAD_CONCURRENCY);
  const loader = createTileLoader({
    cacheLimit: TERRAIN_CACHE_LIMIT,
    scheduler: loadScheduler,
    onCacheChange: () => {
      const status = loader.getStatus?.();
      if (status && ui.cacheStatus) {
        ui.cacheStatus.textContent = `メモリキャッシュ ${status.cacheSize} / ${status.cacheLimit}`;
      }
    }
  });

  let visible = true;
  // terrain-controller replaces the terrain group progressively while loading.
  // Apply the current visibility before each replacement enters the scene so a
  // request that finishes after "hide" cannot make the new group visible again.
  const terrainScene = {
    add(object) {
      object.visible = visible;
      return scene.add(object);
    },
    remove(object) {
      return scene.remove(object);
    }
  };
  Object.defineProperty(loadingStub, 'hidden', {
    configurable: true,
    enumerable: true,
    get() {
      return loadingStub._hidden;
    },
    set(next) {
      loadingStub._hidden = next;
      onLoadingChange?.(!next);
    }
  });
  loadingStub._hidden = true;

  const buildingLayer = createPlateauBuildingLayer(THREE, scene, ui, loadScheduler);

  const terrain = createTerrainController(THREE, {
    loader,
    scene: terrainScene,
    elements,
    cameraController,
    target: cameraController.target,
    focusedTarget,
    focusedSpherical,
    buildingLayer,
    transportLayer: noopFeatureLayer,
    initialLocation,
    initialZone: Number(ui.jprcZone?.value ?? 6),
    displayRadius: DISPLAY_RADIUS,
    lodDelay: TERRAIN_LOD_DELAY,
    getContourIntervalForLod: contourIntervalForLod,
    onStatus: (message, isError) => onStatus?.(message, isError),
    onTerrainCommitted: () => {
      const group = terrain.getGroup();
      if (group) group.visible = visible;
      options.onTerrainCommitted?.();
    },
    onViewChanged: () => {
      if (!visible) return;
      options.onViewChanged?.();
    }
  });

  function setVisible(next) {
    visible = next;
    const group = terrain.getGroup();
    if (group) group.visible = next;
    if (!next && loadingStub.hidden === false) loadingStub.hidden = true;
  }

  function initialRequest(resetFocus = true) {
    if (!visible) return;
    terrain.request({
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
      setting: settingForDistance(focusedSpherical.radius),
      resetFocus
    });
  }

  function reload(resetFocus = false) {
    if (!visible) {
      const group = terrain.getGroup();
      if (group) group.visible = false;
      return;
    }
    terrain.reload(resetFocus);
  }

  function applyFocusElevation() {
    if (visible) terrain.applyFocusElevation();
  }

  function scheduleLodRefresh() {
    if (visible) terrain.scheduleLodRefresh();
  }

  function scheduleStream(delay) {
    if (visible) terrain.scheduleStream(delay);
  }

  function refreshBuildingVisibility() {
    const focus = terrain.getFocusLatLon();
    if (ui.buildingVisibility?.value === 'hide') {
      buildingLayer.clear('建物表示はオフです。');
      return;
    }
    terrain.requestBuilding(focus.latitude, focus.longitude);
  }

  return {
    terrain,
    loader,
    buildingLayer,
    applyFocusElevation,
    scheduleLodRefresh,
    scheduleStream,
    setVisible,
    initialRequest,
    reload,
    refreshBuildingVisibility,
    isVisible: () => visible
  };
}
