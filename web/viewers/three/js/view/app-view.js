/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { geocodeAddress } from '../../../../shared/geo/address-geocode.js';
import {
  buildMvtFeaturePopupElement,
  positionFixedPopupElement
} from '../../../../shared/mvt/mvt-feature-popup.js';
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
      this.renderMapPopup(state.selectedFeature);
      this.renderInspectorHint(state.selectedFeature);
      this.lastSelectedFeature = state.selectedFeature;
    }
  }

  renderInspectorHint(feature) {
    const container = this.elements.inspector;
    if (!container) return;
    container.replaceChildren();
    container.className = 'inspector-empty';
    container.textContent = feature
      ? '地図上のポップアップに属性を表示しています。空き地をクリックで閉じます。'
      : '土地利用・用途地域・道路をクリックすると、地図上に属性ポップアップを表示します（左ドラッグせずにクリック）。';
  }

  renderMapPopup(feature) {
    const shell = this.elements.mapPopup;
    if (!shell) return;

    if (!feature?.popupAnchor) {
      shell.hidden = true;
      shell.replaceChildren();
      return;
    }

    shell.hidden = false;
    shell.replaceChildren();
    shell.append(
      buildMvtFeaturePopupElement(this.document, feature, {
        onClose: () => this.viewModel.setSelectedFeature(null)
      })
    );
    positionFixedPopupElement(shell, feature.popupAnchor);
  }
}
