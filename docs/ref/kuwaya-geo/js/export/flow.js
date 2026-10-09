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

import { downloadBuildingGlb, downloadGlb, downloadTransportGlb } from './glb.js?v=20261002';
import {
  buildTransportOutlinePolylines,
  downloadBuildingFootprintDxf,
  downloadContourDxf,
  downloadTransportDxf
} from './dxf.js?v=20261002';
import { downloadCityGmlDemZip } from './citygml-dem.js?v=20260926-4';
import { snapBoundsToRegionalMeshes } from '../domain/features.js';
import { loadTerrainBatch } from '../domain/terrain.js?v=20260926-4';
import { flattenPolylinesToSegments } from '../domain/polylines.js';

export function createExportState() {
  return {
    preview: null,
    refreshTimer: null,
    isExporting: false,
    begin() {
      if (this.preview || this.isExporting) return false;
      this.isExporting = true;
      return true;
    },
    commit(preview) {
      this.preview = preview;
    },
    take() {
      const preview = this.preview;
      this.preview = null;
      this.isExporting = false;
      return preview;
    },
    schedule(requiredType, callback, delay = 100) {
      if (!this.preview || (requiredType && this.preview.type !== requiredType)) return false;
      const type = this.preview.type;
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => callback(type), delay);
      return true;
    }
  };
}

export async function preparePreview(type, bounds, preparers, interval, contourBuilder) {
  const prepared = type === 'citygml-dem'
    ? await preparers.cityGml(bounds)
    : type.startsWith('building-')
      ? await preparers.building(bounds)
      : type.startsWith('transport-')
        ? await preparers.transport(bounds)
        : await preparers.terrain(bounds);
  const segments = createPreviewSegments(type, prepared.data, interval, contourBuilder);
  try {
    validatePreviewSegments(type, segments);
  } catch (error) {
    releaseTemporaryTerrain(prepared);
    throw error;
  }
  return { prepared, segments, interval };
}

export async function prepareTerrainExport(options) {
  const reusable = !options.bounds
    && options.setting?.detailLevel === options.currentSetting?.detailLevel
    && options.currentOrigin?.latitude === options.origin.latitude
    && options.currentOrigin?.longitude === options.origin.longitude
    && (options.currentOrigin?.altitude ?? 0) === options.origin.altitude;
  if (reusable) return {
    data: options.currentData, origin: options.currentOrigin,
    setting: options.currentSetting, zone: options.currentZone, temporary: false
  };
  const bounds = options.bounds ?? options.displayedBounds;
  if (!bounds) throw new Error('出力範囲を決定できませんでした。');
  const tiles = options.tilesForBounds(bounds, options.setting.tileZoom);
  if (tiles.length > options.maxTiles) {
    throw new RangeError(`選択範囲は${tiles.length}タイルです。上限${options.maxTiles}タイル以内にしてください。`);
  }
  options.onProgress?.(`LOD ${options.setting.detailLevel}・${tiles.length}タイルの出力データを読み込んでいます…`);
  const data = await loadTerrainBatch(options.loader, tiles, options.buildOptions);
  if (!data.length) throw new Error('出力できるタイルを取得できませんでした。');
  return { data, origin: options.origin, setting: options.setting, zone: options.zone, temporary: true };
}

export async function prepareFeatureExport(loader, options) {
  const {
    bounds,
    displayedBounds,
    maxMeshes,
    origin,
    zone,
    datasetLabel,
    onProgress,
    onLoadError = console.warn
  } = options;
  const exportBounds = bounds ?? displayedBounds;
  if (!exportBounds) throw new Error(`${datasetLabel}の出力範囲を決定できませんでした。`);
  const { codes } = snapBoundsToRegionalMeshes(exportBounds, maxMeshes + 1);
  if (codes.length > maxMeshes) {
    throw new RangeError(`${datasetLabel}の対象は${codes.length}地域メッシュです。${maxMeshes}メッシュ以内に範囲を狭めてください。`);
  }
  onProgress?.(`${datasetLabel} ${codes.length}地域メッシュの出力データを読み込んでいます…`);
  const data = (await Promise.all(codes.map(code => loader.load(code, { origin, zone }).catch(error => {
    onLoadError(error);
    return null;
  })))).filter(feature => feature && feature.indices.length > 0);
  if (data.length === 0) throw new Error(`選択範囲に出力できる${datasetLabel}がありません。`);
  return { data, origin, zone, temporary: false, requestedMeshCount: codes.length, requestedCodes: codes };
}

export function createPreviewSegments(type, data, contourInterval, contourBuilder) {
  if (type === 'dxf') return data.flatMap(terrain => contourBuilder(terrain, contourInterval));
  if (type === 'building-dxf') return data.flatMap(building => building.footprintSegments);
  if (type === 'transport-dxf') {
    return flattenPolylinesToSegments(buildTransportOutlinePolylines(data));
  }
  return [];
}

export function validatePreviewSegments(type, segments) {
  const emptyMessages = {
    dxf: '出力できる等高線がありません。',
    'building-dxf': '出力できる建物外形線がありません。',
    'transport-dxf': '出力できる道路外形線がありません。'
  };
  if (emptyMessages[type] && segments.length === 0) throw new Error(emptyMessages[type]);
}

export function releaseTemporaryTerrain(prepared) {
  if (!prepared?.temporary) return;
  for (const data of prepared.data) data.texture.bitmap.close?.();
}

export async function executeExport(preview, options) {
  const { unit, contourMajorEvery, contourLabelHeight, onProgress } = options;
  const common = { unit, origin: preview.prepared.origin, zone: preview.prepared.zone };
  if (preview.type === 'glb') {
    const size = await downloadGlb(preview.prepared.data, { unit });
    return `GLBを生成しました：${preview.prepared.data.length}タイル・${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (preview.type === 'dxf') {
    const result = downloadContourDxf(preview.segments, {
      interval: preview.interval,
      majorEvery: contourMajorEvery,
      minorColor: 8,
      majorColor: 5,
      labelHeight: contourLabelHeight,
      unit,
      tiles: preview.prepared.data.map(terrain => terrain.tile),
      origin: preview.prepared.origin,
      zone: preview.prepared.zone,
      crs: 'EPSG:6668'
    });
    return `等高線DXFを生成しました：${preview.prepared.data.length}タイル・${result.polylineCount.toLocaleString('ja-JP')}ポリライン（${result.segmentCount.toLocaleString('ja-JP')}線分）・${(result.size / 1024).toFixed(1)} KB`;
  }
  if (preview.type === 'citygml-dem') {
    onProgress?.('CityGML ZIPを生成しています…');
    const size = await downloadCityGmlDemZip(preview.prepared, { onProgress });
    const excluded = preview.prepared.excludedMeshCount
      ? `・除外${preview.prepared.excludedMeshCount}`
      : '';
    return `地形CityGMLを生成しました：${preview.prepared.meshCount}三次メッシュ${excluded}・LOD${preview.prepared.cityGmlLod}・${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (preview.type === 'building-glb') {
    const size = downloadBuildingGlb(preview.prepared.data, common);
    return `建物GLBを生成しました：${preview.prepared.data.length}地域メッシュ・${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (preview.type === 'building-dxf') {
    const size = downloadBuildingFootprintDxf(preview.prepared.data, common);
    return `建物外形DXFを生成しました：${preview.prepared.data.length}地域メッシュ・${preview.segments.length.toLocaleString('ja-JP')}線分・${(size / 1024).toFixed(1)} KB`;
  }
  if (preview.type === 'transport-glb') {
    const size = downloadTransportGlb(preview.prepared.data, common);
    return `道路GLBを生成しました：${preview.prepared.data.length}地域メッシュ・${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (preview.type === 'transport-dxf') {
    const result = downloadTransportDxf(preview.prepared.data, common);
    return `道路DXFを生成しました：${preview.prepared.data.length}地域メッシュ・${result.polylineCount.toLocaleString('ja-JP')}ポリライン（${result.segmentCount.toLocaleString('ja-JP')}線分）・${(result.size / 1024).toFixed(1)} KB`;
  }
  throw new RangeError(`未対応の出力形式です: ${preview.type}`);
}
