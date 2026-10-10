/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { geocodeAddress } from '../../../../shared/geo/address-geocode.js';
import {
  inspectFieldsForLayerKind
} from '../../../../shared/mvt/feature-inspect.js';
import { formatUseDistrictSummary } from '../../../../shared/mvt/use-district.js';
import { MVT_VIEWER_LAYERS } from '../../../../shared/mvt/viewer-mvt-layers.js';
import { createAddressSearchController } from '/kuwaya-geo/js/view/ui.js';
import {
  bindViewUi,
  formatCoord,
  isBuildingVisible,
  isMvtLayerVisible,
  isTerrainVisible,
  setMvtLayerToggle,
  setLoading,
  setStatus,
  updateMetadata
} from './view-ui.js';

export class AppView {
  constructor(documentRef, viewModel, scene, elements) {
    this.document = documentRef;
    this.viewModel = viewModel;
    this.scene = scene;
    this.elements = elements ?? bindViewUi(documentRef);
    this.bindEvents();
    this.unsubscribe = viewModel.subscribe(state => this.render(state));
    this.lastSelectedFeature = null;
  }

  bindEvents() {
    const elements = this.elements;
    const originRef = this.scene.getOriginRef();

    elements.originApply?.addEventListener('click', () => {
      const lat = Number(elements.originLatitude?.value);
      const lon = Number(elements.originLongitude?.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        elements.originStatus.textContent = '緯度・経度を正しく入力してください。';
        return;
      }
      elements.originStatus.textContent = `固定原点：${lat.toFixed(8)}, ${lon.toFixed(8)}`;
      this.scene.applyOrigin(lat, lon);
    });

    for (const layer of MVT_VIEWER_LAYERS) {
      const toggleKey = {
        luse: 'toggleMvtLuse',
        road: 'toggleMvtRoad',
        useDistrict: 'toggleMvtUseDistrict'
      }[layer.kind];

      elements[toggleKey]?.addEventListener('click', () => {
        const next = !isMvtLayerVisible(elements, layer.kind);
        setMvtLayerToggle(elements, layer.kind, next);
        this.scene.setDatasetVisible(layer.datasetId, next);
      });
    }

    const searchAddress = createAddressSearchController(elements, {
      geocode: geocodeAddress,
      onStatus: (message, isError) => this.viewModel.setStatus(message, isError),
      onResult: result => this.scene.goToGeocodeResult(result)
    });
    elements.addressSearchSubmit?.addEventListener('click', searchAddress);
    elements.addressSearchInput?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      searchAddress();
    });

    elements.toggleTerrain?.addEventListener('click', () => {
      const next = !isTerrainVisible(elements);
      elements.toggleTerrain.setAttribute('aria-pressed', String(next));
      this.scene.setTerrainVisible(next);
    });

    elements.toggleBuilding?.addEventListener('click', () => {
      const next = !isBuildingVisible(elements);
      elements.toggleBuilding.setAttribute('aria-pressed', String(next));
      this.scene.refreshBuildingVisibility();
    });

    elements.textureType?.addEventListener('change', () => this.scene.reloadTerrain(false));
    elements.jprcZone?.addEventListener('change', () => this.scene.reloadTerrain(true));

    if (elements.localOrigin) {
      elements.localOrigin.textContent = `${formatCoord(originRef.lat)}, ${formatCoord(originRef.lon)}`;
    }

    for (const layer of MVT_VIEWER_LAYERS) {
      setMvtLayerToggle(elements, layer.kind, layer.defaultVisible);
    }
  }

  render(state) {
    const elements = this.elements;
    setStatus(elements, state.status.message, state.status.isError);
    setLoading(elements, state.loading.visible, state.loading.message);

    const origin = state.origin.lat != null
      ? { lat: state.origin.lat, lon: state.origin.lon }
      : this.scene.getOriginRef();

    updateMetadata(elements, {
      viewLat: state.metadata.viewLat ?? origin.lat,
      viewLon: state.metadata.viewLon ?? origin.lon,
      distance: state.metadata.distance,
      tileCount: state.metadata.tileCount,
      planned: state.metadata.planned,
      origin,
      mvtMode: state.metadata.mvtMode,
      mvtTilesLabel: state.metadata.mvtTilesLabel,
      statusLine: null,
      hintLine: state.metadata.hintLine,
      isError: state.metadata.isError
    });

    if (state.selectedFeature !== this.lastSelectedFeature) {
      this.renderInspector(state.selectedFeature);
      this.lastSelectedFeature = state.selectedFeature;
    }
  }

  renderInspector(feature) {
    const container = this.elements.inspector;
    if (!container) return;
    container.replaceChildren();
    if (!feature) {
      container.className = 'inspector-empty';
      container.textContent =
        '土地利用・用途地域・道路をクリックすると属性を表示します（2D 同様・左ドラッグせずにクリック）。';
      return;
    }

    container.className = 'viewer-inspector';
    const { kind, properties } = feature;
    const title = this.document.createElement('h3');
    title.className = 'viewer-inspector-title';
    title.textContent =
      kind === 'luse' ? '土地利用' : kind === 'useDistrict' ? '用途地域' : '道路';
    container.append(title);

    if (kind === 'useDistrict') {
      const summary = this.document.createElement('p');
      summary.className = 'viewer-inspector-summary';
      summary.textContent = formatUseDistrictSummary(properties);
      container.append(summary);
    }

    const metrics = this.document.createElement('dl');
    metrics.className = 'viewer-inspector-metrics';
    for (const field of inspectFieldsForLayerKind(kind, properties)) {
      const dt = this.document.createElement('dt');
      dt.textContent = field.label;
      const dd = this.document.createElement('dd');
      dd.textContent = field.value;
      metrics.append(dt, dd);
    }
    container.append(metrics);

    const featureId = properties.gml_id ?? properties.mvt_id;
    if (featureId != null && featureId !== '') {
      const idNote = this.document.createElement('p');
      idNote.className = 'control-note';
      idNote.style.marginTop = '8px';
      idNote.textContent = `gml_id: ${String(featureId)}`;
      container.append(idNote);
    }
  }
}
