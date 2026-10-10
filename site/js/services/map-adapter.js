import { MeshUtils } from '../model/mesh-utils.js';
import { Model } from '../model/model.js';
import { createIndexedMvtProtocol } from './indexed-mvt-protocol.js';

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: 'FeatureCollection', features: [] });
const OVERLAY_IDS = Object.freeze({
  cityBoundarySource: 'city-boundary-source',
  cityBoundaryLine: 'city-boundary-line',
  meshSource: 'regional-mesh-grid',
  meshFill: 'regional-mesh-fill',
  meshLine: 'regional-mesh-line',
  webTileSource: 'web-mercator-grid',
  webTileLine: 'web-mercator-line'
});

export class MapAdapter {
  constructor(maplibregl, containerId) {
    this.maplibregl = maplibregl;
    this.containerId = containerId;
    this.map = null;
    this.ready = false;
    this.pendingState = null;
    this.mvtSourcesReady = false;
    this.mvtSourcesPromise = null;
    this.indexedMvt = createIndexedMvtProtocol();
    this.sourceIds = [];
    this.layerIds = { luse: [], road: [] };
    this.fillLayerIds = { luse: [], road: [] };
    this.meshMarkers = [];
    this.webTileMarkers = [];
    this.webTileLabelGeneration = 0;
    this.meshOverlayKey = '';
    this.webTileOverlayKey = '';
    this.requestUrls = new Set();
    this.transferredBytes = 0;
    this.sourceErrors = new Set();
    this.selectedFeatureTarget = null;
    this.callbacks = {};
  }

  initialize(callbacks) {
    this.callbacks = {
      onViewportChanged: callbacks.onViewportChanged ?? (() => {}),
      onFeatureSelected: callbacks.onFeatureSelected ?? (() => {}),
      onStatus: callbacks.onStatus ?? (() => {}),
      onStats: callbacks.onStats ?? (() => {})
    };

    this.maplibregl.addProtocol(this.indexedMvt.name, this.indexedMvt.handler);

    this.map = new this.maplibregl.Map({
      container: this.containerId,
      center: [139.7670, 35.6834],
      zoom: 16.2,
      minZoom: 5,
      maxZoom: 19,
      hash: true,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          'gsi-base': {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 2,
            maxzoom: 18,
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
          }
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#e7e9e4' } },
          {
            id: 'gsi-base',
            type: 'raster',
            source: 'gsi-base',
            paint: { 'raster-opacity': 1, 'raster-saturation': -0.15, 'raster-contrast': 0.04 }
          }
        ]
      }
    });

    this.map.addControl(new this.maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.addControl(new this.maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    this.map.on('load', () => {
      this.ready = true;
      this.ensureOverlayLayers();
      if (this.pendingState) this.sync(this.pendingState);
      this.emitViewport();
      this.observeResources();
      this.callbacks.onStatus(`${Model.CONFIG.dataYear}年度 PLATEAU MVT 接続済み`, 'ready');
    });

    this.map.on('moveend', () => this.emitViewport());
    this.map.on('zoomend', () => this.emitViewport());
    this.map.on('sourcedataloading', event => {
      if (this.sourceIds.includes(event.sourceId)) this.callbacks.onStatus('MVTを読み込み中', 'loading');
    });
    this.map.on('idle', () => {
      if (this.sourceErrors.size) {
        this.callbacks.onStatus(`${this.sourceErrors.size}件のMVTを読み込めませんでした`, 'error');
      } else if (this.pendingState) {
        this.callbacks.onStatus('タイル索引によるMVT表示完了', 'ready');
      }
    });
    this.map.on('error', event => this.handleMapError(event));
    this.map.on('mousemove', event => this.handleMouseMove(event));
    this.map.on('click', event => this.handleClick(event));
  }

  sync(state) {
    this.pendingState = state;
    if (!this.ready) return;

    if (!this.mvtSourcesReady) {
      if (!this.mvtSourcesPromise) {
        this.mvtSourcesPromise = this.syncMvtSources().then(() => {
          this.mvtSourcesReady = true;
          this.sync(this.pendingState);
        }).catch(error => this.callbacks.onStatus(error.message, 'error'));
      }
    } else {
      this.syncMvtStyle(state);
    }
    this.syncCityBoundaryStyle(state.visibility.cityBoundary);
    const meshKey = [
      state.visibility.mesh,
      state.viewport.mesh.digits,
      state.viewport.mesh.centerCode,
      state.viewport.mesh.codes.join(',')
    ].join(':');
    if (meshKey !== this.meshOverlayKey) {
      this.meshOverlayKey = meshKey;
      this.syncMeshOverlay(state.visibility.mesh, state.viewport.mesh);
    }

    const webTileKey = [
      state.visibility.webTile,
      state.viewport.webTile.zoom,
      state.viewport.webTile.centerCode,
      state.viewport.webTile.tiles.map(tile => `${tile.x}/${tile.y}`).join(',')
    ].join(':');
    if (webTileKey !== this.webTileOverlayKey) {
      this.webTileOverlayKey = webTileKey;
      this.syncWebTileOverlay(state.visibility.webTile, state.viewport.webTile);
    }
  }

  goToPlace(placeId) {
    const place = Model.PLACES[placeId];
    if (place && this.map) this.map.easeTo({ center: place.center, zoom: place.zoom, duration: 900 });
  }

  emitViewport() {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    const center = this.map.getCenter();
    const viewportBounds = {
      north: bounds.getNorth(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      west: bounds.getWest()
    };
    const viewportCenter = { latitude: center.lat, longitude: center.lng };
    const zoom = this.map.getZoom();
    this.callbacks.onViewportChanged({
      zoom,
      mesh: MeshUtils.meshViewport(viewportBounds, viewportCenter, zoom),
      webTile: MeshUtils.webTileViewport(viewportBounds, viewportCenter, zoom)
    });
  }

  ensureOverlayLayers() {
    const map = this.map;
    map.addSource(OVERLAY_IDS.cityBoundarySource, {
      type: 'geojson',
      data: '/data/city_geojson/r2ka13_city.geojson'
    });
    map.addLayer({
      id: OVERLAY_IDS.cityBoundaryLine,
      type: 'line',
      source: OVERLAY_IDS.cityBoundarySource,
      paint: {
        'line-color': '#f43f5e',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 1.8, 18, 3],
        'line-opacity': 0.92,
        'line-dasharray': [3, 1.5]
      }
    });
    map.addSource(OVERLAY_IDS.meshSource, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
    map.addLayer({
      id: OVERLAY_IDS.meshFill,
      type: 'fill',
      source: OVERLAY_IDS.meshSource,
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.035 }
    });
    map.addLayer({
      id: OVERLAY_IDS.meshLine,
      type: 'line',
      source: OVERLAY_IDS.meshSource,
      paint: { 'line-color': '#2563eb', 'line-width': 1.1, 'line-opacity': 0.86 }
    });
    map.addSource(OVERLAY_IDS.webTileSource, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
    map.addLayer({
      id: OVERLAY_IDS.webTileLine,
      type: 'line',
      source: OVERLAY_IDS.webTileSource,
      paint: { 'line-color': '#dc2626', 'line-width': 1.25, 'line-opacity': 0.9 }
    });
  }

  async syncMvtSources() {
    this.clearMvtSources();
    this.requestUrls.clear();
    this.transferredBytes = 0;
    this.sourceErrors.clear();
    this.callbacks.onStats({ requests: 0, bytes: 0 });

    const definitions = [
      { kind: 'luse', datasetId: 'luse-2025', sourceLayer: 'luse' },
      { kind: 'road', datasetId: 'tran-lod1-2025', sourceLayer: 'Road' }
    ];
    for (const definition of definitions) {
      const manifest = await this.indexedMvt.loadManifest(definition.datasetId);
      for (const city of manifest.cities) this.addMvtCity(definition, city.cityCode);
    }
    this.bringOverlaysToFront();
  }

  addMvtCity({ kind, datasetId, sourceLayer }, cityCode) {
    const source = Model.sourceId(kind, cityCode);
    const fill = Model.layerId(kind, 'fill', cityCode);
    const line = Model.layerId(kind, 'line', cityCode);
    this.map.addSource(source, {
      type: 'vector',
      tiles: [this.indexedMvt.tileTemplate(datasetId, cityCode)],
      minzoom: Model.CONFIG.mvtMinZoom,
      maxzoom: Model.CONFIG.mvtMinZoom,
      promoteId: 'gml_id',
      attribution: '国土交通省 PLATEAU'
    });

    const isLuse = kind === 'luse';
    this.map.addLayer({
        id: fill,
        type: 'fill',
        source,
        'source-layer': sourceLayer,
        minzoom: Model.CONFIG.mvtMinZoom,
        paint: {
          'fill-color': this.selectedAwareValue('#ff4d8d', isLuse ? [
            'match', ['get', 'uro_orgLandUse'],
            '道路', '#f59e48',
            '公園', '#40c98a',
            '河川', '#4ca9df',
            '水面・河川・水路', '#4ca9df',
            '#47e6b1'
          ] : '#ffc85a'),
          'fill-opacity': this.featureOpacity(isLuse ? 0.46 : 0.58, 0.78)
        }
    });
    this.map.addLayer({
        id: line,
        type: 'line',
        source,
        'source-layer': sourceLayer,
        minzoom: Model.CONFIG.mvtMinZoom,
        paint: {
          'line-color': this.selectedAwareValue('#ffffff', isLuse ? '#116d54' : '#7f5c12'),
          'line-width': this.selectedAwareValue(3.2, ['interpolate', ['linear'], ['zoom'], 14, isLuse ? 0.5 : 0.6, 17, isLuse ? 1.4 : 1.6]),
          'line-opacity': this.featureOpacity(isLuse ? 0.84 : 0.9, 1)
        }
    });
    this.sourceIds.push(source);
    this.layerIds[kind].push(fill, line);
    this.fillLayerIds[kind].push(fill);
  }

  clearMvtSources() {
    this.clearSelectedFeature();
    Object.values(this.layerIds).flat().forEach(id => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    this.sourceIds.forEach(id => {
      if (this.map.getSource(id)) this.map.removeSource(id);
    });
    this.sourceIds = [];
    this.layerIds = { luse: [], road: [] };
    this.fillLayerIds = { luse: [], road: [] };
  }

  syncMvtStyle(state) {
    for (const kind of ['luse', 'road']) {
      const visibility = state.visibility[kind] ? 'visible' : 'none';
      this.layerIds[kind].forEach(id => {
        if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visibility);
      });
      const opacity = this.featureOpacity(state.opacity[kind], 0.78);
      this.fillLayerIds[kind].forEach(id => {
        if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'fill-opacity', opacity);
      });
    }
  }

  syncCityBoundaryStyle(visible) {
    if (!this.map.getLayer(OVERLAY_IDS.cityBoundaryLine)) return;
    this.map.setLayoutProperty(
      OVERLAY_IDS.cityBoundaryLine,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }

  selectedAwareValue(selectedValue, defaultValue) {
    return [
      'case',
      ['boolean', ['feature-state', 'selected'], false], selectedValue,
      defaultValue
    ];
  }

  featureOpacity(defaultValue, selectedValue) {
    return [
      'case',
      ['boolean', ['feature-state', 'selected'], false], selectedValue,
      defaultValue
    ];
  }

  syncMeshOverlay(enabled, meshState) {
    const source = this.map.getSource(OVERLAY_IDS.meshSource);
    if (!source) return;
    this.clearMarkers(this.meshMarkers);
    this.meshMarkers = [];
    if (!enabled) {
      source.setData(EMPTY_FEATURE_COLLECTION);
      return;
    }

    const features = meshState.codes.map(code => {
      const bounds = MeshUtils.meshBounds(code);
      return this.boundsFeature(bounds, { code });
    });
    source.setData({ type: 'FeatureCollection', features });

    const stride = Math.max(1, Math.ceil(meshState.codes.length / 180));
    meshState.codes.forEach((code, index) => {
      if (index % stride !== 0 && code !== meshState.centerCode) return;
      const bounds = MeshUtils.meshBounds(code);
      this.meshMarkers.push(this.addLabel(
        code,
        [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
        `grid-label grid-label--mesh grid-label--mesh-${meshState.digits}`
      ));
    });
  }

  syncWebTileOverlay(enabled, tileState) {
    const generation = ++this.webTileLabelGeneration;
    const source = this.map.getSource(OVERLAY_IDS.webTileSource);
    if (!source) return;
    this.clearMarkers(this.webTileMarkers);
    this.webTileMarkers = [];
    if (!enabled) {
      source.setData(EMPTY_FEATURE_COLLECTION);
      return;
    }

    const features = tileState.tiles.map(tile => {
      const bounds = MeshUtils.tileBounds(tile.x, tile.y, tile.z);
      return this.boundsFeature(bounds, { code: `${tile.z}/${tile.x}/${tile.y}` });
    });
    source.setData({ type: 'FeatureCollection', features });

    const stride = Math.max(1, Math.ceil(tileState.tiles.length / 120));
    const labelTiles = tileState.tiles.filter((tile, index) => index % stride === 0);
    Promise.all(labelTiles.map(async tile => {
      const [luse, road] = await Promise.all([
        this.indexedMvt.resolveCityCodes('luse-2025', tile.z, tile.x, tile.y),
        this.indexedMvt.resolveCityCodes('tran-lod1-2025', tile.z, tile.x, tile.y)
      ]);
      return { tile, luse, road };
    })).then(labels => {
      if (generation !== this.webTileLabelGeneration) return;
      for (const { tile, luse, road } of labels) {
        const luseLabel = luse.length ? luse.join(',') : '—';
        const roadLabel = road.length ? road.join(',') : '—';
        const cityLabel = luseLabel === roadLabel
          ? `自治体 ${luseLabel}`
          : `L:${luseLabel}  R:${roadLabel}`;
        const bounds = MeshUtils.tileBounds(tile.x, tile.y, tile.z);
        this.webTileMarkers.push(this.addLabel(
          `${tile.z}/${tile.x}/${tile.y}\n${cityLabel}`,
          [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2],
          'grid-label grid-label--web-tile'
        ));
      }
    }).catch(error => {
      if (generation === this.webTileLabelGeneration) console.warn('自治体コード表示', error);
    });
  }

  boundsFeature(bounds, properties) {
    return {
      type: 'Feature',
      properties,
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds.west, bounds.south],
          [bounds.east, bounds.south],
          [bounds.east, bounds.north],
          [bounds.west, bounds.north],
          [bounds.west, bounds.south]
        ]]
      }
    };
  }

  addLabel(text, lngLat, className) {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    element.setAttribute('aria-hidden', 'true');
    return new this.maplibregl.Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(this.map);
  }

  clearMarkers(markers) {
    markers.forEach(marker => marker.remove());
  }

  bringOverlaysToFront() {
    [
      OVERLAY_IDS.meshFill,
      OVERLAY_IDS.meshLine,
      OVERLAY_IDS.webTileLine,
      OVERLAY_IDS.cityBoundaryLine
    ].forEach(id => {
      if (this.map.getLayer(id)) this.map.moveLayer(id);
    });
  }

  interactiveLayerIds() {
    return [...this.fillLayerIds.luse, ...this.fillLayerIds.road].filter(id => this.map.getLayer(id));
  }

  handleMouseMove(event) {
    const layers = this.interactiveLayerIds();
    if (!layers.length) return;
    const features = this.visibleRenderedFeatures(
      this.map.queryRenderedFeatures(event.point, { layers })
    );
    this.map.getCanvas().style.cursor = features.length ? 'pointer' : '';
  }

  handleClick(event) {
    const layers = this.interactiveLayerIds();
    const features = layers.length
      ? this.visibleRenderedFeatures(this.map.queryRenderedFeatures(event.point, { layers }))
      : [];
    const feature = Model.uniqueRenderedFeatures(features)[0];
    if (!feature) {
      this.clearSelectedFeature();
      this.callbacks.onFeatureSelected(null);
      return;
    }
    this.selectFeatureOnMap(feature);
    this.callbacks.onFeatureSelected(feature);

    const popup = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'popup-label';
    label.textContent = feature.layer.id.startsWith('luse-') ? 'LAND USE' : 'ROAD';
    const value = document.createElement('div');
    value.className = 'popup-id';
    value.textContent = String(feature.properties?.gml_id || feature.properties?.mvt_id || 'IDなし');
    popup.append(label, value);
    new this.maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(event.lngLat)
      .setDOMContent(popup)
      .addTo(this.map);
  }

  visibleRenderedFeatures(features) {
    return features;
  }

  selectFeatureOnMap(feature) {
    this.clearSelectedFeature();
    if (feature.id === undefined || feature.id === null) return;

    const target = {
      source: feature.source,
      sourceLayer: feature.sourceLayer,
      id: feature.id
    };
    if (!target.source || !target.sourceLayer || !this.map.getSource(target.source)) return;

    this.map.setFeatureState(target, { selected: true });
    this.selectedFeatureTarget = target;
  }

  clearSelectedFeature() {
    const target = this.selectedFeatureTarget;
    this.selectedFeatureTarget = null;
    if (!target || !this.map?.getSource(target.source)) return;
    this.map.removeFeatureState(target, 'selected');
  }

  handleMapError(event) {
    const sourceId = event?.sourceId;
    const message = event?.error?.message || 'データを読み込めませんでした';
    if (sourceId === 'gsi-base') {
      this.callbacks.onStatus('背景地図を読み込めませんでした', 'error');
    } else if (sourceId === OVERLAY_IDS.cityBoundarySource) {
      this.callbacks.onStatus('市区町村境界を読み込めませんでした', 'error');
    } else if (sourceId && this.sourceIds.includes(sourceId)) {
      this.sourceErrors.add(sourceId);
      this.callbacks.onStatus('対象データなし、または読込エラー', 'error');
    } else if (message.includes('plateau') || message.includes('TileJSON') || message.includes('404')) {
      this.callbacks.onStatus('対象データなし、または読込エラー', 'error');
    }
    console.warn(event?.error || event);
  }

  observeResources() {
    if (!('PerformanceObserver' in globalThis)) return;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.name.includes('.mvt') || this.requestUrls.has(entry.name)) continue;
        this.requestUrls.add(entry.name);
        this.transferredBytes += entry.transferSize || entry.encodedBodySize || 0;
      }
      this.callbacks.onStats({ requests: this.requestUrls.size, bytes: this.transferredBytes });
    });
    observer.observe({ type: 'resource', buffered: true });
  }
}


