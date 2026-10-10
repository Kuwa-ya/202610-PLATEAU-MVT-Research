/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
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
      basemapSelect: this.must('basemap-select'),
      addressSearchInput: this.must('address-search-input'),
      addressSearchSubmit: this.must('address-search-submit'),
      addressSearchStatus: this.must('address-search-status')
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

    elements.basemapSelect.addEventListener('change', () => {
      const basemap = basemapById(elements.basemapSelect.value);
      this.map.setBasemap(basemap);
    });

    const runAddressSearch = () => {
      const query = elements.addressSearchInput.value ?? '';
      void this.runAddressSearch(query);
    };
    elements.addressSearchSubmit.addEventListener('click', () => runAddressSearch());
    elements.addressSearchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runAddressSearch();
      }
    });
  }

  async runAddressSearch(query) {
    const { addressSearchSubmit, addressSearchInput } = this.elements;
    addressSearchSubmit.disabled = true;
    this.viewModel.setAddressSearchStatus('住所を検索しています…');
    try {
      const result = await this.map.searchAddress(query);
      this.viewModel.setAddressSearchStatus(`移動しました：${result.matchedAddress}`);
    } catch (error) {
      this.viewModel.setAddressSearchStatus(error?.message ?? '住所検索に失敗しました。');
    } finally {
      addressSearchSubmit.disabled = false;
      addressSearchInput.focus();
    }
  }

  render(state) {
    this.setToggle(this.elements.toggleLuse, state.visibility?.luse !== false);
    this.setToggle(this.elements.toggleRoad, state.visibility?.road !== false);
    this.setToggle(this.elements.toggleUseDistrict, state.visibility?.useDistrict !== false);
    this.setToggle(this.elements.toggleCityBoundary, state.visibility.cityBoundary);
    this.setToggle(this.elements.toggleMesh, state.visibility.mesh);
    this.setToggle(this.elements.toggleWebTile, state.visibility.webTile);

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

    if (state.selectedFeature !== this.lastSelectedFeature) {
      this.renderInspector(state.selectedFeature);
      this.lastSelectedFeature = state.selectedFeature;
    }

    if (state.addressSearchStatus) {
      this.elements.addressSearchStatus.textContent = state.addressSearchStatus;
    }

    this.map.sync(state);
  }

  setToggle(element, enabled) {
    element.setAttribute('aria-pressed', String(Boolean(enabled)));
  }

  renderInspector(feature) {
    const container = this.elements.inspector;
    container.replaceChildren();
    if (!feature) {
      container.className = 'inspector-empty';
      container.textContent = '土地利用・用途地域・道路をクリックすると属性を表示します（用途地域は建ぺい率・容積率を上部に要約）。';
      return;
    }

    container.className = '';
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
}
