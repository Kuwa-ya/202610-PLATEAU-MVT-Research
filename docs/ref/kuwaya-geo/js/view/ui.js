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

const SELECTORS = {
  workspace: '.workspace', menuToggle: '#menu-toggle', currentLatitude: '#current-latitude',
  currentLongitude: '#current-longitude', cameraDistance: '#camera-distance', centerTile: '#center-tile',
  textureType: '#texture-type', zone: '#jprc-zone', download: '#download-glb', canvas: '#terrain-canvas',
  viewer: '#viewer', loading: '#loading', status: '#status', cacheStatus: '#cache-status', demTile: '#dem-tile',
  requestedLod: '#requested-lod', viewerCurrentLod: '#viewer-current-lod', viewerRequestedLod: '#viewer-requested-lod',
  viewerRequestedRow: '#viewer-requested-row', selectionToggle: '#selection-toggle', selectionStatus: '#selection-status',
  selectionClear: '#selection-clear', exportLod: '#export-lod', contourInterval: '#contour-interval',
  contourVisibility: '#contour-visibility', contourStatus: '#contour-status', buildingVisibility: '#building-visibility',
  buildingStatus: '#building-status', downloadDxf: '#download-dxf', downloadCityGmlDem: '#download-citygml-dem',
  citygmlDemLod: '#citygml-dem-lod', downloadBuildingGlb: '#download-building-glb',
  downloadBuildingDxf: '#download-building-dxf', transportVisibility: '#transport-visibility',
  transportStatus: '#transport-status', downloadTransportGlb: '#download-transport-glb',
  downloadTransportDxf: '#download-transport-dxf', textureTiles: '#texture-tiles', localOrigin: '#local-origin',
  vertexCount: '#vertex-count', exportPreview: '#export-preview', exportPreviewTitle: '#export-preview-title',
  exportPreviewSummary: '#export-preview-summary', exportPreviewCancel: '#export-preview-cancel',
  exportPreviewConfirm: '#export-preview-confirm', addressSearchInput: '#address-search-input',
  addressSearchSubmit: '#address-search-submit', addressSearchStatus: '#address-search-status',
  exportUnit: '#export-unit', exportOriginLatitude: '#export-origin-latitude',
  exportOriginLongitude: '#export-origin-longitude', exportOriginApply: '#export-origin-apply',
  exportOriginStatus: '#export-origin-status', accessCount: '#access-count'
};

export function bindUi(document) {
  const viewerControls = document.querySelector('#viewer-controls');
  for (const selector of ['.output-settings', '.tile-settings', '.coordinate-settings', '.origin-settings']) {
    const section = viewerControls?.querySelector(selector);
    if (section) viewerControls.append(section);
  }
  return Object.fromEntries(
    Object.entries(SELECTORS).map(([name, selector]) => [name, document.querySelector(selector)])
  );
}

export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function enhanceSelect(document, select) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const options = document.createElement('div');
  options.className = 'custom-select-options';
  options.setAttribute('role', 'listbox');
  options.hidden = true;

  function updateSelection() {
    trigger.textContent = select.selectedOptions[0]?.textContent ?? '';
    for (const button of options.querySelectorAll('[role="option"]')) {
      const selected = button.dataset.value === select.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', String(selected));
    }
  }

  for (const option of select.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-select-option';
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.setAttribute('role', 'option');
    button.addEventListener('click', () => {
      select.value = option.value;
      updateSelection();
      options.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      trigger.focus();
    });
    options.append(button);
  }

  trigger.addEventListener('click', () => {
    const opening = options.hidden;
    document.querySelectorAll('.custom-select-options:not([hidden])').forEach(list => { list.hidden = true; });
    document.querySelectorAll('.custom-select-trigger[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    options.hidden = !opening;
    trigger.setAttribute('aria-expanded', String(opening));
    if (opening) options.querySelector('.selected')?.focus();
  });
  wrapper.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    options.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (wrapper.contains(event.target)) return;
    options.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  });

  select.classList.add('native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.insertAdjacentElement('afterend', wrapper);
  wrapper.append(trigger, options);
  select.addEventListener('change', updateSelection);
  select.customSelectUpdate = updateSelection;
  select.customSelectOptions = options;
  updateSelection();
}

export function initializeUi(document, elements, contourIntervals) {
  for (const interval of [...new Set(contourIntervals)].sort((first, second) => first - second)) {
    const option = document.createElement('option');
    option.value = String(interval);
    option.textContent = `${interval} m`;
    elements.contourInterval.append(option);
  }
  document.querySelectorAll('select').forEach(select => enhanceSelect(document, select));

  const layerTabs = [...document.querySelectorAll('[role="tab"][aria-controls]')];
  function activateLayerTab(tab) {
    for (const candidate of layerTabs) {
      const selected = candidate === tab;
      candidate.classList.toggle('selected', selected);
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    }
  }
  for (const [index, tab] of layerTabs.entries()) {
    tab.addEventListener('click', () => activateLayerTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? layerTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + layerTabs.length) % layerTabs.length;
      activateLayerTab(layerTabs[nextIndex]);
      layerTabs[nextIndex].focus();
    });
  }
}

export function setSelectOptionLabel(select, value, label) {
  const option = [...select.options].find(item => item.value === value);
  if (!option) return;
  option.textContent = label;
  const button = select.customSelectOptions?.querySelector(`[data-value="${value}"]`);
  if (button) button.textContent = label;
  select.customSelectUpdate?.();
}

export function renderExportPreviewSummary(document, elements, type, prepared, segments, options) {
  const setting = prepared.setting;
  const isBuilding = type.startsWith('building-');
  const isTransport = type.startsWith('transport-');
  const isCityGml = type === 'citygml-dem';
  const isRegionalMeshLayer = isBuilding || isTransport;
  const formatName = type === 'glb' ? '地形GLB'
    : type === 'dxf' ? '等高線DXF'
      : type === 'citygml-dem' ? '地形CityGML（ZIP）'
        : type === 'building-glb' ? '建物GLB'
          : type === 'building-dxf' ? '建物外形DXF（Z=0）'
            : type === 'transport-glb' ? '道路GLB（Z=0）' : '道路DXF（Z=0）';
  const rows = [['出力形式', formatName]];
  if (isCityGml) {
    const estimate = options.estimateCityGml(prepared.meshCount, prepared.cityGmlLod);
    rows.push(
      ['CityGML DEM LOD', prepared.label ?? options.cityGmlLods[prepared.cityGmlLod]?.label],
      ['三次メッシュ', `${prepared.meshCount}出力 / ${prepared.requestedMeshCount ?? prepared.meshCount}要求（上限 ${estimate.limit}）`],
      ['除外', prepared.excludedMeshCount
        ? `${prepared.excludedMeshCount}（${prepared.excludedMeshCodes.join(', ')}）`
        : 'なし'],
      ['頂点数', prepared.vertexCount.toLocaleString('ja-JP')],
      ['三角形数', prepared.triangleCount.toLocaleString('ja-JP')],
      ['座標系', 'EPSG:6697'],
      ['同梱', 'udx/dem（CityGMLコア relief）'],
      ['注意', prepared.cityGmlLod === 3 ? 'LOD3はファイルサイズが大きくなります' : 'XMLのためGLBより大きくなります']
    );
  } else {
    rows.push(
      ['基準LOD', `LOD ${setting.detailLevel}`],
      ['出力単位', options.unit],
      ['固定原点', `${prepared.origin.latitude.toFixed(8)}, ${prepared.origin.longitude.toFixed(8)} / 0 m`],
      ['対象範囲', isRegionalMeshLayer ? `${prepared.data.length}/${prepared.requestedMeshCount}地域メッシュ` : `${prepared.data.length}タイル`]
    );
    if (!isRegionalMeshLayer) rows.push(
      ['標高DEM', `z${setting.elevationZoom}（DEM1A → DEM5A補完）`],
      ['画像', `z${setting.imageZoom}`]
    );
    if (type === 'dxf') rows.push(
      ['等高線間隔', `${options.contourInterval} m`],
      ['線分数', segments.length.toLocaleString('ja-JP')]
    );
    if (type.endsWith('-dxf') && type !== 'dxf') rows.push(
      ['外形線', `${segments.length.toLocaleString('ja-JP')}線分／高さ0`]
    );
  }
  elements.exportPreviewTitle.textContent = `${formatName}の出力内容を確認`;
  elements.exportPreviewSummary.replaceChildren(...rows.map(([term, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
}

export function updateExportAvailability(elements, state) {
  const unavailable = state.isExporting || !state.hasTerrain;
  elements.download.disabled = unavailable || state.exceedsTerrainLimit;
  elements.downloadDxf.disabled = unavailable || state.contourInterval <= 0 || state.exceedsTerrainLimit;
  elements.downloadCityGmlDem.disabled = unavailable || state.exceedsCityGmlLimit;
  for (const element of [elements.downloadBuildingGlb, elements.downloadBuildingDxf,
    elements.downloadTransportGlb, elements.downloadTransportDxf]) {
    element.disabled = unavailable || state.exceedsRegionalLimit;
  }
  const terrainTitle = state.exceedsTerrainLimit
    ? `選択範囲を${state.maxExportTiles}タイル以内にしてください。`
    : '';
  elements.download.title = terrainTitle;
  elements.downloadDxf.title = terrainTitle;
  elements.downloadCityGmlDem.title = state.exceedsCityGmlLimit
    ? `CityGML DEM LOD${state.cityGmlLod}は${state.cityGmlLimit}三次メッシュ以内にしてください（現在 ${state.cityGmlCount}）。範囲を狭めるか、未選択で注視点の1メッシュを使ってください。`
    : '';
  const regionalTitle = state.exceedsRegionalLimit
    ? `選択範囲を${state.maxRegionalMeshes}地域メッシュ以内にしてください。`
    : '';
  elements.downloadBuildingGlb.title = regionalTitle;
  elements.downloadBuildingDxf.title = regionalTitle;
  elements.downloadTransportGlb.title = regionalTitle;
  elements.downloadTransportDxf.title = regionalTitle;
}

export function bindUiActions(elements, actions) {
  elements.textureType.addEventListener('change', actions.changeTexture);
  elements.zone.addEventListener('change', actions.changeZone);
  elements.buildingVisibility.addEventListener('change', actions.changeBuildingVisibility);
  elements.transportVisibility.addEventListener('change', actions.changeTransportVisibility);
  elements.contourInterval.addEventListener('change', actions.changeContourInterval);
  elements.contourVisibility.addEventListener('change', actions.changeContourVisibility);
  const previews = [
    [elements.download, 'glb'], [elements.downloadDxf, 'dxf'],
    [elements.downloadCityGmlDem, 'citygml-dem'], [elements.downloadBuildingGlb, 'building-glb'],
    [elements.downloadBuildingDxf, 'building-dxf'], [elements.downloadTransportGlb, 'transport-glb'],
    [elements.downloadTransportDxf, 'transport-dxf']
  ];
  for (const [element, type] of previews) element.addEventListener('click', () => actions.openPreview(type));
  elements.exportLod.addEventListener('change', actions.changeExportLod);
  elements.exportUnit.addEventListener('change', actions.changeExportUnit);
  elements.citygmlDemLod.addEventListener('change', actions.changeCityGmlLod);
  elements.exportOriginApply.addEventListener('click', actions.applyExportOrigin);
  elements.selectionToggle.addEventListener('click', actions.toggleSelection);
  elements.selectionClear.addEventListener('click', actions.clearSelection);
  elements.addressSearchSubmit?.addEventListener('click', actions.searchAddress);
  elements.addressSearchInput?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    actions.searchAddress();
  });
  elements.menuToggle.addEventListener('click', () => {
    const collapsed = elements.workspace.classList.toggle('menu-collapsed');
    elements.menuToggle.setAttribute('aria-expanded', String(!collapsed));
  });
  elements.exportPreviewCancel.addEventListener('click', actions.cancelPreview);
  elements.exportPreviewConfirm.addEventListener('click', actions.confirmPreview);
}

export function createAddressSearchController(elements, options) {
  return async function searchAddress() {
    const address = elements.addressSearchInput?.value ?? '';
    if (!address.trim()) {
      elements.addressSearchStatus.textContent = '住所を入力してください。';
      elements.addressSearchStatus.classList.add('error');
      options.onStatus('住所を入力してください。', true);
      return;
    }
    elements.addressSearchSubmit.disabled = true;
    elements.addressSearchStatus.classList.remove('error');
    elements.addressSearchStatus.textContent = '住所を検索しています…';
    options.onStatus('住所を検索しています…', false);
    try {
      const result = await options.geocode(address);
      await options.onResult(result);
      elements.addressSearchStatus.textContent = `移動先：${result.matchedAddress}`;
      options.onStatus(`${result.matchedAddress} へ移動しました。`, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '住所の検索に失敗しました。';
      elements.addressSearchStatus.textContent = message;
      elements.addressSearchStatus.classList.add('error');
      options.onStatus(message, true);
    } finally {
      elements.addressSearchSubmit.disabled = false;
    }
  };
}
