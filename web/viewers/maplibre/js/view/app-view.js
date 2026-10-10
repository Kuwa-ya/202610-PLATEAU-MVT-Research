import { Model } from '../model/model.js';
import {
  formatUseDistrictSummary,
  useDistrictCoveragePercent,
  useDistrictFloorAreaPercent,
  useDistrictLabel
} from '../../../../shared/mvt/use-district.js';

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
      opacityLuse: this.must('opacity-luse'),
      opacityRoad: this.must('opacity-road'),
      opacityUseDistrict: this.must('opacity-use-district'),
      opacityLuseValue: this.must('opacity-luse-value'),
      opacityRoadValue: this.must('opacity-road-value'),
      opacityUseDistrictValue: this.must('opacity-use-district-value')
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

    this.document.querySelectorAll('[data-place]').forEach(button => {
      button.addEventListener('click', () => this.map.goToPlace(button.dataset.place));
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

    if (state.selectedFeature !== this.lastSelectedFeature) {
      this.renderInspector(state.selectedFeature);
      this.lastSelectedFeature = state.selectedFeature;
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
    const isUseDistrict = layerId.startsWith('useDistrict-');
    const props = feature.properties || {};

    const title = this.document.createElement('h3');
    title.className = 'feature-title';
    title.textContent = layerId.startsWith('luse-')
      ? '土地利用'
      : isUseDistrict
        ? '用途地域'
        : '道路';
    container.append(title);

    if (isUseDistrict) {
      const summary = this.document.createElement('p');
      summary.className = 'feature-summary';
      summary.textContent = formatUseDistrictSummary(props);
      container.append(summary);

      const metrics = this.document.createElement('dl');
      metrics.className = 'feature-metrics';
      const rows = [
        ['種別', useDistrictLabel(props), false],
        ['建ぺい率', useDistrictCoveragePercent(props), true],
        ['容積率', useDistrictFloorAreaPercent(props), true]
      ];
      for (const [label, value, asPercent] of rows) {
        const dt = this.document.createElement('dt');
        dt.textContent = label;
        const dd = this.document.createElement('dd');
        dd.textContent =
          value == null || value === ''
            ? '—'
            : asPercent
              ? `${value}%`
              : String(value);
        metrics.append(dt, dd);
      }
      container.append(metrics);
    }

    const list = this.document.createElement('div');
    list.className = 'properties';
    const entries = Object.entries(feature.properties || {})
      .filter(([, value]) => value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [key, rawValue] of entries) {
      const row = this.document.createElement('div');
      row.className = 'prop';
      const name = this.document.createElement('span');
      name.className = 'prop-key';
      name.textContent = key;
      const value = this.document.createElement('span');
      value.className = 'prop-value';
      const text = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
      value.textContent = text.length > 600 ? `${text.slice(0, 600)}…` : text;
      row.append(name, value);
      list.append(row);
    }
    container.append(list);
  }
}


