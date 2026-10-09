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

import {
  boundsFromPoints, createSelectionOutline, createSelectionState, describeSelection,
  disposeSelectionOutline, pickTerrainPoint
} from './selection.js?v=20260926-4';

export function createSelectionController(THREE, options) {
  const selection = createSelectionState();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let outline = null;

  const bounds = () => selection.bounds();

  function updateOutline() {
    disposeSelectionOutline(options.scene, outline);
    outline = null;
    const rawBounds = bounds() ?? (selection.points.length === 1 && selection.previewPoint
      ? boundsFromPoints(selection.points[0], selection.previewPoint)
      : null);
    const setting = options.getExportSetting();
    const origin = options.getOrigin();
    if (!rawBounds || !origin || !setting) return;
    outline = createSelectionOutline(THREE, rawBounds, {
      setting,
      origin,
      zone: options.getZone(),
      elevation: options.getElevation(),
      maxExportTiles: options.maxExportTiles,
      maxRegionalMeshes: options.maxRegionalMeshes
    });
    options.scene.add(outline);
  }

  function updateStatus() {
    const selectedBounds = bounds();
    options.elements.selectionClear.disabled = selection.points.length === 0;
    if (!selectedBounds) {
      options.elements.selectionStatus.textContent = selection.points.length === 1
        ? '1点目を設定しました。対角となる2点目を選択してください。' : '';
      options.elements.selectionStatus.hidden = selection.points.length !== 1;
      options.elements.selectionStatus.classList.remove('error');
      options.onChange?.();
      return;
    }
    const setting = options.getExportSetting();
    if (!setting) return;
    const description = describeSelection(selectedBounds, {
      setting,
      maxExportTiles: options.maxExportTiles,
      maxRegionalMeshes: options.maxRegionalMeshes,
      cityGmlLod: options.getCityGmlLod(),
      cityGmlLimits: options.cityGmlLimits,
      displayLevels: options.displayLevels
    });
    options.elements.selectionStatus.hidden = false;
    options.elements.selectionStatus.textContent = description.text;
    options.elements.selectionStatus.classList.toggle('error', description.error);
    options.elements.selectionClear.disabled = false;
    options.onChange?.();
  }

  function terrainPoint(event) {
    return pickTerrainPoint({
      event,
      canvas: options.elements.canvas,
      camera: options.camera,
      terrain: options.getTerrainGroup(),
      origin: options.getOrigin(),
      zone: options.getZone(),
      raycaster,
      pointer
    });
  }

  function select(event) {
    const point = terrainPoint(event);
    if (!point) {
      options.onStatus('地形上の点を選択してください。', true);
      return;
    }
    if (selection.addPoint(point)) {
      options.elements.selectionToggle.setAttribute('aria-pressed', 'false');
      options.elements.selectionToggle.textContent = '2点で範囲を選択';
      updateOutline();
      options.onSelectionComplete?.();
    } else {
      options.elements.selectionToggle.textContent = '地形上の2点目を選択';
    }
    updateStatus();
  }

  function preview(event) {
    const point = terrainPoint(event);
    if (!point) return;
    selection.setPreview(point);
    updateOutline();
  }

  function clear() {
    selection.clear();
    options.elements.selectionToggle.setAttribute('aria-pressed', 'false');
    options.elements.selectionToggle.textContent = '2点で範囲を選択';
    updateOutline();
    updateStatus();
  }

  function toggle() {
    if (selection.toggle()) updateOutline();
    options.elements.selectionToggle.setAttribute('aria-pressed', String(selection.mode));
    options.elements.selectionToggle.textContent = selection.mode ? '地形上の1点目を選択' : '2点で範囲を選択';
    updateStatus();
  }

  return {
    bounds,
    clear,
    preview,
    select,
    toggle,
    updateOutline,
    updateStatus,
    isPreviewMode: () => selection.mode && selection.points.length === 1,
    isClickMode: pointerEvent => selection.mode && pointerEvent?.button === 0
  };
}
