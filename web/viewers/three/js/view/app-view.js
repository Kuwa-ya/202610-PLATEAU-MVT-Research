import {
  bindViewUi,
  formatCoord,
  readEnabledDatasets,
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

    elements.viewReset?.addEventListener('click', () => this.scene.resetView());
    elements.viewZoomMvt?.addEventListener('click', () => this.scene.zoomToMvtDistance());

    for (const [select, datasetId] of [
      [elements.luseVisibility, 'luse-2025'],
      [elements.tranVisibility, 'tran-lod1-2025']
    ]) {
      select?.addEventListener('change', () => {
        const visible = select.value !== 'hide';
        this.scene.setDatasetVisible(datasetId, visible);
      });
    }

    elements.terrainVisibility?.addEventListener('change', () => {
      const show = elements.terrainVisibility.value !== 'hide';
      this.scene.setTerrainVisible(show);
    });

    elements.buildingVisibility?.addEventListener('change', () => {
      this.scene.refreshBuildingVisibility();
    });

    elements.textureType?.addEventListener('change', () => this.scene.reloadTerrain(false));
    elements.jprcZone?.addEventListener('change', () => this.scene.reloadTerrain(true));

    if (elements.localOrigin) {
      elements.localOrigin.textContent = `${formatCoord(originRef.lat)}, ${formatCoord(originRef.lon)}`;
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
  }
}
