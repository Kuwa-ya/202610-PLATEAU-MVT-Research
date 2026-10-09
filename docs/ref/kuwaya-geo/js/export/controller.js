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

import { buildContourSegments } from '../domain/contours.js';
import { snapBoundsToRegionalMeshes } from '../domain/features.js';
import { thirdMeshCodeFromLatLon, thirdMeshCodesForBounds } from '../geometric/japan-mesh-code.js';
import { createExportPreviewGroup, disposePreviewGroup, tilesForBounds } from '../view/selection.js?v=20260926-4';
import { renderExportPreviewSummary, updateExportAvailability } from '../view/ui.js?v=20260926-4';
import { CITYGML_DEM_LODS, estimateCityGmlStats, prepareCityGmlDemExport } from './citygml-dem.js?v=20260926-4';
import {
  createExportState, executeExport, prepareFeatureExport, preparePreview,
  prepareTerrainExport, releaseTemporaryTerrain
} from './flow.js?v=20261002';

export function createExportController(THREE, options) {
  const state = createExportState();
  let origin = { ...options.initialOrigin, altitude: 0 };

  const getSetting = () => options.elements.exportLod.value === 'current'
    ? options.getTerrainSetting()
    : options.displayLevels.find(setting => setting.detailLevel === Number(options.elements.exportLod.value))
      ?? options.getTerrainSetting();

  const displayedBounds = () => options.getDisplayedTerrainBounds();

  function cityGmlMeshCodes(limit = Infinity) {
    const selectedBounds = options.getSelectionBounds();
    if (selectedBounds) return thirdMeshCodesForBounds(selectedBounds, limit);
    const focus = options.getFocusLatLon();
    return [thirdMeshCodeFromLatLon(focus.latitude, focus.longitude)];
  }

  function updateAvailability() {
    const selectedBounds = options.getSelectionBounds();
    const setting = getSetting();
    const currentSetting = options.getTerrainSetting();
    const usesDisplayedMesh = !selectedBounds && setting?.detailLevel === currentSetting?.detailLevel;
    const terrainBounds = selectedBounds ?? (usesDisplayedMesh ? null : displayedBounds());
    const exceedsTerrainLimit = Boolean(terrainBounds && setting
      && tilesForBounds(terrainBounds, setting.tileZoom).length > options.maxExportTiles);
    const regionalBounds = selectedBounds ?? displayedBounds();
    const exceedsRegionalLimit = Boolean(regionalBounds
      && snapBoundsToRegionalMeshes(regionalBounds, options.maxRegionalMeshes + 1).codes.length > options.maxRegionalMeshes);
    const cityGmlLod = Number(options.elements.citygmlDemLod?.value ?? 1);
    const cityGmlLimit = options.cityGmlLimits[cityGmlLod] ?? options.cityGmlLimits[1];
    const codes = cityGmlMeshCodes(cityGmlLimit + 1);
    updateExportAvailability(options.elements, {
      isExporting: state.isExporting,
      hasTerrain: options.getTerrainData().length > 0,
      contourInterval: options.contours.getInterval(),
      exceedsTerrainLimit,
      exceedsRegionalLimit,
      exceedsCityGmlLimit: codes.length > cityGmlLimit,
      maxExportTiles: options.maxExportTiles,
      maxRegionalMeshes: options.maxRegionalMeshes,
      cityGmlLod,
      cityGmlLimit,
      cityGmlCount: codes.length
    });
  }

  async function prepareTerrain(bounds) {
    const setting = getSetting();
    const exportOrigin = { ...origin };
    const zone = options.getZone();
    return prepareTerrainExport({
      bounds,
      displayedBounds: displayedBounds(),
      setting,
      origin: exportOrigin,
      zone,
      currentData: options.getTerrainData(),
      currentSetting: options.getTerrainSetting(),
      currentOrigin: options.getTerrainOrigin(),
      currentZone: zone,
      loader: options.loader,
      tilesForBounds,
      maxTiles: options.maxExportTiles,
      buildOptions: {
        origin: exportOrigin,
        zone,
        heightScale: 1,
        textureType: options.elements.textureType.value,
        textureZoom: setting.imageZoom,
        elevationZoom: setting.elevationZoom,
        fallbackElevationZoom: setting.fallbackElevationZoom,
        gridSize: setting.gridSize
      },
      onProgress: message => options.onStatus(message)
    });
  }

  async function prepareFeature(loader, label, bounds) {
    const prepared = await prepareFeatureExport(loader, {
      bounds,
      displayedBounds: displayedBounds(),
      maxMeshes: options.maxRegionalMeshes,
      origin: { ...origin },
      zone: options.getZone(),
      datasetLabel: label,
      onProgress: message => options.onStatus(message)
    });
    return { ...prepared, setting: getSetting() ?? options.getTerrainSetting() };
  }

  async function prepareCityGml(bounds) {
    const cityGmlLod = Number(options.elements.citygmlDemLod.value);
    const limit = options.cityGmlLimits[cityGmlLod] ?? options.cityGmlLimits[1];
    const codes = bounds ? thirdMeshCodesForBounds(bounds, limit + 1) : cityGmlMeshCodes(limit + 1);
    if (codes.length === 0) throw new Error('選択範囲に三次メッシュがありません。');
    if (codes.length > limit) {
      throw new RangeError(`CityGML DEM LOD${cityGmlLod}の対象は${codes.length}三次メッシュです。${limit}メッシュ以内に範囲を狭めてください。`);
    }
    const prepared = await prepareCityGmlDemExport(options.loader, {
      meshCodes: codes,
      cityGmlLod,
      onProgress: message => options.onStatus(message)
    });
    return {
      ...prepared,
      origin: { ...origin },
      zone: options.getZone(),
      setting: getSetting() ?? options.getTerrainSetting(),
      temporary: false,
      requestedCodes: codes
    };
  }

  function clearPreview() {
    const preview = state.take();
    if (!preview) return;
    disposePreviewGroup(options.scene, preview.group);
    releaseTemporaryTerrain(preview.prepared);
    options.elements.exportPreview.hidden = true;
    updateAvailability();
  }

  async function openPreview(type) {
    if (options.getTerrainData().length === 0 || !state.begin()) return;
    updateAvailability();
    let prepared = null;
    try {
      const result = await preparePreview(type, options.getSelectionBounds(), {
        terrain: prepareTerrain,
        building: bounds => prepareFeature(options.buildingLoader, '建物', bounds),
        transport: bounds => prepareFeature(options.transportLoader, '道路', bounds),
        cityGml: prepareCityGml
      }, options.contours.getInterval(), buildContourSegments);
      ({ prepared } = result);
      const { segments, interval } = result;
      const group = createExportPreviewGroup(THREE, options.document, prepared, type, segments, {
        displayLabelPixels: options.contours.settingForLod(options.getTerrainSetting()?.detailLevel ?? 17).displayLabelPixels,
        currentOrigin: options.getTerrainOrigin(),
        currentZone: options.getZone()
      });
      options.scene.add(group);
      state.commit({ type, prepared, segments, interval, group });
      renderExportPreviewSummary(options.document, options.elements, type, prepared, segments, {
        unit: options.elements.exportUnit.value,
        contourInterval: options.contours.getInterval(),
        estimateCityGml: estimateCityGmlStats,
        cityGmlLods: CITYGML_DEM_LODS
      });
      options.elements.exportPreview.hidden = false;
      options.onStatus(type === 'citygml-dem'
        ? '橙色のCityGMLプレビューを確認し、ダウンロードを実行してください。'
        : '黄色の出力プレビューを確認し、ダウンロードを実行してください。');
    } catch (error) {
      releaseTemporaryTerrain(prepared);
      state.take();
      updateAvailability();
      console.error(error);
      options.onStatus(error instanceof Error ? error.message : '出力プレビューの生成に失敗しました。', true);
    }
  }

  function schedulePreviewRefresh(requiredType = null) {
    state.schedule(requiredType, type => {
      clearPreview();
      options.onStatus('変更した設定で出力プレビューを再計算しています…');
      openPreview(type);
    }, 100);
  }

  function applyOrigin() {
    const latitude = Number(options.elements.exportOriginLatitude.value);
    const longitude = Number(options.elements.exportOriginLongitude.value);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      options.elements.exportOriginStatus.textContent = '緯度は-90～90、経度は-180～180で入力してください。';
      options.elements.exportOriginStatus.classList.add('error');
      return;
    }
    origin = { latitude, longitude, altitude: 0 };
    options.elements.exportOriginLatitude.value = latitude.toFixed(8);
    options.elements.exportOriginLongitude.value = longitude.toFixed(8);
    options.elements.exportOriginStatus.textContent = `固定原点：${latitude.toFixed(8)}, ${longitude.toFixed(8)}／標高0 m`;
    options.elements.exportOriginStatus.classList.remove('error');
    options.onStatus('出力用3Dローカル原点を更新しました。以後の全形式へ共通適用します。');
    schedulePreviewRefresh();
  }

  async function confirmPreview() {
    const preview = state.preview;
    if (!preview) return;
    options.elements.exportPreviewConfirm.disabled = true;
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      options.onStatus(await executeExport(preview, {
        unit: options.elements.exportUnit.value,
        contourMajorEvery: options.contourMajorEvery,
        contourLabelHeight: options.contours.settingForLod(preview.prepared.setting?.detailLevel ?? 17).labelHeight,
        onProgress: message => options.onStatus(message)
      }));
    } catch (error) {
      console.error(error);
      options.onStatus(error instanceof Error ? error.message : 'ファイルの生成に失敗しました。', true);
    } finally {
      options.elements.exportPreviewConfirm.disabled = false;
      clearPreview();
    }
  }

  return {
    applyOrigin,
    cancelPreview: () => { clearPreview(); options.onStatus('出力プレビューをキャンセルしました。'); },
    clearPreview,
    confirmPreview,
    getPreviewGroup: () => state.preview?.group,
    getSetting,
    openPreview,
    schedulePreviewRefresh,
    updateAvailability
  };
}
