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

import { basemapById } from '../../../../shared/geo/plateau-basemap.js';
import { inspectFieldsForLayerKind, layerKindFromMapLayerId } from '../../../../shared/mvt/feature-inspect.js';
import { Model } from '../model/model.js';
import { formatUseDistrictSummary } from '../../../../shared/mvt/use-district.js';

export class AppView {
  constructor(documentRef, viewModel, mapAdapter) {
    this.document = documentRef;
    this.viewModel = viewModel;
    this.map = mapAdapter;
    this.lastSelectedFeature = undefined;
    this.lastPickDebug = undefined;

    this.elements = {
      status: this.must('status'),
      statusText: this.must('status-text'),
      zoomGate: this.must('zoom-gate'),
      zoomNote: this.must('zoom-note'),
      statZoom: this.must('stat-zoom'),
      statRequests: this.must('stat-requests'),
      statBytes: this.must('stat-bytes'),
      meshCode: this.must('mesh-code'),
      webTileCode: this.must('web-tile-code'),
      inspector: this.must('inspector'),
      toggleLuse: this.must('toggle-luse'),
      toggleRoad: this.must('toggle-road'),
      toggleUseDistrict: this.must('toggle-use-district'),
      toggleCityBoundary: this.must('toggle-city-boundary'),
      toggleMesh: this.must('toggle-mesh'),
      toggleWebTile: this.must('toggle-web-tile'),
      opacityLuse: this.must('opacity-luse'),
      opacityRoad: this.must('opacity-road'),
      opacityUseDistrict: this.must('opacity-use-district'),
      opacityLuseValue: this.must('opacity-luse-value'),
      opacityRoadValue: this.must('opacity-road-value'),
      opacityUseDistrictValue: this.must('opacity-use-district-value'),
      basemapSelect: this.must('basemap-select'),
      toggleDedupeFeatures: this.must('toggle-dedupe-features')
    };

    this.bindEvents();
    this.unsubscribe = viewModel.subscribe(state => this.render(state));
  }

  must(id) {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`画面要素が見つかりません: #${id}`);
    return element;
  }

  bindEvents() {
    const elements = this.elements;
    const toggles = [
      [elements.toggleLuse, 'luse'],
      [elements.toggleRoad, 'road'],
      [elements.toggleUseDistrict, 'useDistrict'],
      [elements.toggleCityBoundary, 'cityBoundary'],
      [elements.toggleMesh, 'mesh'],
      [elements.toggleWebTile, 'webTile']
    ];
    for (const [element, kind] of toggles) {
      element.addEventListener('click', () => {
        const current = this.viewModel.getState().visibility[kind];
        this.viewModel.setVisibility(kind, !current);
      });
    }

    elements.opacityLuse.addEventListener('input', () => {
      this.viewModel.setOpacity('luse', Number(elements.opacityLuse.value) / 100);
    });
    elements.opacityRoad.addEventListener('input', () => {
      this.viewModel.setOpacity('road', Number(elements.opacityRoad.value) / 100);
    });
    elements.opacityUseDistrict.addEventListener('input', () => {
      this.viewModel.setOpacity('useDistrict', Number(elements.opacityUseDistrict.value) / 100);
    });

    elements.basemapSelect.addEventListener('change', () => {
      const basemap = basemapById(elements.basemapSelect.value);
      this.map.setBasemap(basemap);
    });

    elements.toggleDedupeFeatures.addEventListener('change', () => {
      this.viewModel.setDedupeFeaturesById(elements.toggleDedupeFeatures.checked);
    });
  }

  render(state) {
    this.setToggle(this.elements.toggleLuse, state.visibility?.luse !== false);
    this.setToggle(this.elements.toggleRoad, state.visibility?.road !== false);
    this.setToggle(this.elements.toggleUseDistrict, state.visibility?.useDistrict !== false);
    this.setToggle(this.elements.toggleCityBoundary, state.visibility.cityBoundary);
    this.setToggle(this.elements.toggleMesh, state.visibility.mesh);
    this.setToggle(this.elements.toggleWebTile, state.visibility.webTile);

    const lusePercent = Math.round((state.opacity?.luse ?? 0.46) * 100);
    const roadPercent = Math.round((state.opacity?.road ?? 0.58) * 100);
    const useDistrictPercent = Math.round((state.opacity?.useDistrict ?? 0.38) * 100);
    this.elements.opacityLuse.value = String(lusePercent);
    this.elements.opacityRoad.value = String(roadPercent);
    this.elements.opacityUseDistrict.value = String(useDistrictPercent);
    this.elements.opacityLuseValue.textContent = `${lusePercent}%`;
    this.elements.opacityRoadValue.textContent = `${roadPercent}%`;
    this.elements.opacityUseDistrictValue.textContent = `${useDistrictPercent}%`;

    this.elements.status.classList.toggle('loading', state.status.mode === 'loading');
    this.elements.status.classList.toggle('error', state.status.mode === 'error');
    this.elements.statusText.textContent = state.status.message;

    const zoom = state.stats.zoom;
    this.elements.statZoom.textContent = Number.isFinite(zoom) ? zoom.toFixed(2) : '—';
    this.elements.statRequests.textContent = String(state.stats.requests);
    this.elements.statBytes.textContent = state.stats.bytes > 0
      ? `${(state.stats.bytes / 1048576).toFixed(2)} MB`
      : '—';
    this.elements.meshCode.textContent = state.viewport.mesh.centerCode ?? '範囲外';
    this.elements.webTileCode.textContent = state.viewport.webTile.centerCode ?? '—';

    const hasZoom = Number.isFinite(zoom);
    const belowMvtZoom = hasZoom && zoom < Model.CONFIG.mvtMinZoom;
    this.elements.zoomGate.classList.toggle('visible', belowMvtZoom);
    this.elements.zoomNote.classList.toggle('good', hasZoom && !belowMvtZoom);
    this.elements.zoomNote.textContent = !hasZoom
      ? '地図を初期化しています。'
      : belowMvtZoom
      ? `ズーム${Model.CONFIG.mvtMinZoom}未満では、重い低ズームMVTを読み込みません。`
      : `ズーム${Model.CONFIG.mvtMinZoom}以上。PLATEAU MVTをネイティブ表示しています。`;

    this.elements.toggleDedupeFeatures.checked = state.dedupeFeaturesById !== false;

    if (
      state.selectedFeature !== this.lastSelectedFeature
      || state.featurePickDebug !== this.lastPickDebug
    ) {
      this.renderInspector(state.selectedFeature, state.featurePickDebug);
      this.lastSelectedFeature = state.selectedFeature;
      this.lastPickDebug = state.featurePickDebug;
    }

    this.map.sync(state);
  }

  setToggle(element, enabled) {
    element.setAttribute('aria-pressed', String(Boolean(enabled)));
  }

  renderInspector(feature, pickDebug) {
    const container = this.elements.inspector;
    container.replaceChildren();
    if (!feature) {
      container.className = 'inspector-empty';
      container.textContent = '土地利用・用途地域・道路をクリックすると属性を表示します（用途地域は建ぺい率・容積率を上部に要約）。';
      return;
    }

    container.className = '';
    if (pickDebug?.hits?.length) {
      container.append(this.buildPickDebugBlock(pickDebug));
    }
    const layerId = feature.layer.id;
    const kind = layerKindFromMapLayerId(layerId);
    const props = feature.properties || {};

    const title = this.document.createElement('h3');
    title.className = 'feature-title';
    title.textContent =
      kind === 'luse' ? '土地利用' : kind === 'useDistrict' ? '用途地域' : '道路';
    container.append(title);

    if (kind === 'useDistrict') {
      const summary = this.document.createElement('p');
      summary.className = 'feature-summary';
      summary.textContent = formatUseDistrictSummary(props);
      container.append(summary);
    }

    const metrics = this.document.createElement('dl');
    metrics.className = 'feature-metrics';
    for (const field of inspectFieldsForLayerKind(kind, props)) {
      const dt = this.document.createElement('dt');
      dt.textContent = field.label;
      const dd = this.document.createElement('dd');
      dd.textContent = field.value;
      metrics.append(dt, dd);
    }
    container.append(metrics);

    const featureId = props.gml_id ?? props.mvt_id;
    if (featureId != null && featureId !== '') {
      const idNote = this.document.createElement('p');
      idNote.className = 'hint';
      idNote.style.marginTop = '10px';
      idNote.textContent = `gml_id: ${String(featureId)}`;
      container.append(idNote);
    }
  }

  buildPickDebugBlock(pickDebug) {
    const wrap = this.document.createElement('div');
    wrap.className = 'pick-debug';
    const summary = this.document.createElement('p');
    summary.textContent = pickDebug.dedupeEnabled
      ? `重複排除 ON — 命中 ${pickDebug.rawCount} 件 → 候補 ${pickDebug.poolCount} 件（先頭を表示）`
      : `重複排除 OFF — 命中 ${pickDebug.rawCount} 件（描画最前面を表示）`;
    wrap.append(summary);

    const table = this.document.createElement('table');
    table.innerHTML =
      '<thead><tr><th>#</th><th>gml_id</th><th>頂点</th><th>layer</th><th></th></tr></thead>';
    const tbody = this.document.createElement('tbody');
    for (const hit of pickDebug.hits) {
      const tr = this.document.createElement('tr');
      if (hit.isChosen) tr.className = 'pick-chosen';
      tr.innerHTML = `<td>${hit.order + 1}</td><td>${hit.featureId}</td><td>${hit.vertices}</td><td>${hit.layerId}</td><td>${hit.isChosen ? '← 採用' : ''}</td>`;
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }
}


