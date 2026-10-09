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

import { createTileSquare, latLonToTile } from '../geometric/web-mesh-code.js';
import { localPositionToLatLon } from '../foundation/local-frame.js';
import { LOAD_PRIORITY } from '../config.js?v=20260926-4';
import { createLatestRequestQueue } from '../foundation/cache.js';
import { settingForDistance, settingWithHysteresis } from '../foundation/lod.js';
import {
  createFocusElevationController, loadTerrainBatch, summarizeTerrainData
} from '../domain/terrain.js?v=20260926-4';
import {
  createTerrainGroup, disposeTerrainEntries, disposeTerrainGroup, orderedTerrainData,
  planTerrainTransition, stageTerrainEntries
} from './terrain-layer.js';
import { setSelectOptionLabel } from './ui.js';

export function createTerrainController(THREE, options) {
  let group = null;
  let data = [];
  let entries = new Map();
  let centerTile = null;
  let setting = null;
  let origin = null;
  let zone = options.initialZone;
  let textureType = null;
  let viewLocation = { ...options.initialLocation };
  let streamTimer = null;
  let lodTimer = null;
  const queue = createLatestRequestQueue();

  function getFocusLatLon() {
    if (!origin) return { ...viewLocation };
    return localPositionToLatLon(
      options.focusedTarget.x,
      options.focusedTarget.z,
      origin,
      zone
    );
  }

  const focusElevation = createFocusElevationController({
    loader: options.loader,
    target: options.focusedTarget,
    getOrigin: () => origin,
    getZone: () => zone,
    getTerrainData: () => data,
    getFocusLatLon
  });
  const applyFocusElevation = () => focusElevation.apply();

  async function requestBuilding(latitude, longitude) {
    if (!setting || !origin) return;
    await options.buildingLayer.request({ latitude, longitude, detailLevel: setting.detailLevel, origin, zone });
  }

  async function requestTransport(latitude, longitude) {
    if (!setting || !origin) return;
    await options.transportLayer.request({ latitude, longitude, detailLevel: setting.detailLevel, origin, zone });
  }

  async function requestFeatures(latitude, longitude) {
    await Promise.allSettled([requestBuilding(latitude, longitude), requestTransport(latitude, longitude)]);
  }

  function updateOptionLabels() {
    setSelectOptionLabel(options.elements.exportLod, 'current', `表示（LOD ${setting.detailLevel}）`);
    setSelectOptionLabel(
      options.elements.contourInterval,
      'auto',
      `自動（${options.getContourIntervalForLod(setting.detailLevel)} m）`
    );
  }

  function recenter(nextGroup) {
    options.cameraController.recenter(nextGroup);
    applyFocusElevation();
  }

  async function request(requestOptions) {
    const sequence = queue.begin(requestOptions);
    const signal = queue.signalFor(sequence);
    const { latitude, longitude, setting: nextSetting, automatic = false, resetFocus = false } = requestOptions;
    options.elements.requestedLod.textContent = `LOD ${nextSetting.detailLevel}（読込中）`;
    options.elements.viewerRequestedLod.textContent = `LOD ${nextSetting.detailLevel}（読込中）`;
    options.elements.viewerRequestedRow.hidden = false;
    const nextCenterTile = latLonToTile(latitude, longitude, nextSetting.tileZoom);
    const tiles = createTileSquare(nextCenterTile, options.displayRadius);
    const nextOrigin = automatic && origin ? { ...origin } : { latitude, longitude, altitude: 0 };
    const nextZone = Number(options.elements.zone.value);
    const nextTextureType = options.elements.textureType.value;
    const transition = planTerrainTransition({
      centerTile: nextCenterTile,
      tiles,
      setting: nextSetting,
      origin: nextOrigin,
      zone: nextZone,
      textureType: nextTextureType,
      automatic,
      resetFocus,
      currentGroup: group,
      currentEntries: entries,
      currentSetting: setting,
      currentOrigin: origin,
      currentZone: zone,
      currentTextureType: textureType
    });
    const { reusable, retainedEntries, tilesToBuild, removedTileCount } = transition;
    if (!group) {
      options.elements.loading.hidden = false;
      options.elements.download.disabled = true;
    }

    let stagedEntries = new Map();
    let committed = false;
    let firstCommit = true;
    const previousOrigin = origin;
    try {
      const buildOptions = {
        origin: nextOrigin, zone: nextZone, heightScale: 1, textureType: nextTextureType,
        textureZoom: nextSetting.imageZoom, elevationZoom: nextSetting.elevationZoom,
        fallbackElevationZoom: nextSetting.fallbackElevationZoom, gridSize: nextSetting.gridSize,
        signal
      };
      const commitProgress = () => {
        signal.throwIfAborted();
        if (!queue.isCurrent(sequence)) throw signal.reason;
        const nextData = orderedTerrainData(tiles, retainedEntries, stagedEntries);
        if (nextData.length === 0) return;
        const previousGroup = group;
        const nextLayer = createTerrainGroup(THREE, tiles, retainedEntries, stagedEntries);
        group = nextLayer.group;
        entries = nextLayer.entries;
        data = nextData;
        centerTile = nextCenterTile;
        setting = nextSetting;
        origin = nextOrigin;
        zone = nextZone;
        textureType = nextTextureType;
        viewLocation = { latitude, longitude };
        options.scene.add(group);
        committed = true;
        if (firstCommit) {
          if (previousGroup && resetFocus) {
            options.target.x = 0;
            options.target.z = 0;
            options.focusedTarget.x = 0;
            options.focusedTarget.z = 0;
            applyFocusElevation();
            options.cameraController.update();
          } else if (previousGroup && automatic && previousOrigin) {
            applyFocusElevation();
            options.cameraController.update();
          } else {
            recenter(group);
          }
          firstCommit = false;
        }
        if (previousGroup) {
          options.scene.remove(previousGroup);
          disposeTerrainGroup(previousGroup);
        }
      };
      const buildTile = async (tile, priority) => {
        const builtData = await loadTerrainBatch(options.loader, [tile], { ...buildOptions, priority });
        signal.throwIfAborted();
        if (builtData.length) {
          const staged = stageTerrainEntries(THREE, builtData);
          for (const [key, entry] of staged) stagedEntries.set(key, entry);
          commitProgress();
          options.onProgress?.({ loaded: stagedEntries.size, total: tilesToBuild.length, tile });
        }
      };

      // The tile list is center-first. Make the first useful tile visible before
      // starting the outer ring, then retain bounded parallelism in the loader.
      // Queue the outer ring before starting features so shared scheduler
      // slots go to remaining terrain first. Features still begin after the
      // center tile is visible, without waiting for the full 3×3.
      if (tilesToBuild.length > 0) {
        await buildTile(tilesToBuild[0], LOAD_PRIORITY.terrainCenter);
        const ringWork = tilesToBuild.slice(1).map(tile => buildTile(tile, LOAD_PRIORITY.terrainRing));
        void requestFeatures(latitude, longitude);
        await Promise.all(ringWork);
      } else {
        commitProgress();
        void requestFeatures(latitude, longitude);
      }
      signal.throwIfAborted();
      if (data.length === 0 || setting !== nextSetting) throw new Error('表示できる画像タイルを取得できませんでした。');

      options.elements.centerTile.textContent = `${nextCenterTile.z}/${nextCenterTile.x}/${nextCenterTile.y}`;
      options.elements.currentLatitude.textContent = latitude.toFixed(8);
      options.elements.currentLongitude.textContent = longitude.toFixed(8);
      options.onTerrainCommitted?.();
      options.onViewChanged?.();

      const summary = summarizeTerrainData(data);
      const {
        textureTileCount, vertexCount, triangleCount, elevationSources, elevationZooms,
        flatTileCount, zeroFallbackReasons, elevationMin, elevationMax, textureZooms
      } = summary;
      updateOptionLabels();
      const elevationSummary = elevationZooms.length
        ? `DEM z${elevationZooms.join('–')} (${elevationSources.join('+')})`
        : 'DEM 0 m';
      const flatSummary = flatTileCount > 0
        ? ` / 0 m ${flatTileCount}タイル (${zeroFallbackReasons.join('/') || 'noData'})`
        : '';
      const elevationRange = ` / 標高 ${elevationMin.toFixed(1)}–${elevationMax.toFixed(1)} m`;
      options.elements.demTile.textContent = `LOD ${nextSetting.detailLevel} / tile z${nextSetting.tileZoom} / ${elevationSummary}${flatSummary}${elevationRange}`;
      options.elements.viewerCurrentLod.textContent = `LOD ${nextSetting.detailLevel}・tile z${nextSetting.tileZoom}・DEM z${elevationZooms.join('–') || '0 m'}`;
      options.elements.textureTiles.textContent = `z${textureZooms.join('–')} / ${textureTileCount}枚`;
      options.elements.localOrigin.textContent = `${origin.latitude.toFixed(6)}, ${origin.longitude.toFixed(6)}`;
      options.elements.vertexCount.textContent = vertexCount.toLocaleString('ja-JP');
      const cacheStatus = options.loader.getStatus?.();
      if (cacheStatus) {
        options.elements.cacheStatus.textContent = `メモリキャッシュ ${cacheStatus.cacheSize} / ${cacheStatus.cacheLimit}`
          + `・欠損 ${cacheStatus.negativeSize} / ${cacheStatus.negativeLimit}`
          + `・hit ${cacheStatus.hits}（欠損 ${cacheStatus.negativeHits}）`
          + `・miss ${cacheStatus.misses}・待機 ${cacheStatus.waiting}`;
      }
      options.onAvailabilityChange?.();
      const updateSummary = reusable
        ? `差分 追加${stagedEntries.size}・維持${retainedEntries.size}・削除${removedTileCount}`
        : '全体更新';
      options.onStatus(`LOD ${nextSetting.detailLevel}・${tiles.length}タイル・${triangleCount.toLocaleString('ja-JP')}三角形・${updateSummary}`);
    } catch (error) {
      if (!committed) disposeTerrainEntries(stagedEntries);
      if (signal.aborted) return;
      console.error(error);
      options.onStatus(error instanceof Error ? error.message : '地形の読み込みに失敗しました。', true);
    } finally {
      if (queue.isCurrent(sequence)) {
        options.elements.loading.hidden = true;
        queue.finish(sequence);
        {
          options.elements.requestedLod.textContent = '—';
          options.elements.viewerRequestedLod.textContent = '—';
          options.elements.viewerRequestedRow.hidden = true;
        }
      }
    }
  }

  function streamToTarget() {
    if (data.length === 0 || !centerTile || !setting) return;
    const focus = getFocusLatLon();
    const focusTile = latLonToTile(focus.latitude, focus.longitude, setting.tileZoom);
    if (focusTile.x === centerTile.x && focusTile.y === centerTile.y) {
      requestFeatures(focus.latitude, focus.longitude);
      return;
    }
    viewLocation = { ...focus };
    request({ ...focus, setting, automatic: true });
  }

  function scheduleStream(delay) {
    applyFocusElevation();
    clearTimeout(streamTimer);
    streamTimer = setTimeout(streamToTarget, delay);
  }

  function scheduleLodRefresh() {
    clearTimeout(lodTimer);
    lodTimer = setTimeout(() => {
      if (!setting) return;
      const next = settingWithHysteresis(options.focusedSpherical.radius, setting.detailLevel);
      if (next.detailLevel === setting.detailLevel) return;
      request({ ...getFocusLatLon(), setting: next, automatic: true });
    }, options.lodDelay);
  }

  function reload(resetFocus = false) {
    request({
      ...getFocusLatLon(),
      setting: settingForDistance(options.focusedSpherical.radius),
      automatic: true,
      resetFocus
    });
  }

  return {
    applyFocusElevation,
    getCenterTile: () => centerTile,
    getData: () => data,
    getEntries: () => entries,
    getFocusLatLon,
    getGroup: () => group,
    getOrigin: () => origin,
    getSetting: () => setting,
    getTextureType: () => textureType,
    getZone: () => zone,
    reload,
    request,
    requestBuilding,
    requestFeatures,
    requestTransport,
    scheduleLodRefresh,
    scheduleStream,
    streamToTarget
  };
}
