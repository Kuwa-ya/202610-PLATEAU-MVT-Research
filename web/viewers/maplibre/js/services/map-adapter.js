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

import { geocodeAddress } from '../../../../shared/geo/address-geocode.js';
import { mapZoomForAddressMatch } from '../../../../shared/geo/address-map-view.js';
import { DEFAULT_VIEWER_LOCATION } from '../../../../shared/geo/viewer-defaults.js';
import { BOUNDARY_LAYERS } from '../../../../shared/mvt/data-region.js';
import { maplibreLuseFillColorExpression } from '../../../../shared/mvt/feature-style.js';
import { DEFAULT_BASEMAP } from '../../../../shared/geo/plateau-basemap.js';
import { USE_DISTRICT_DATASET_ID } from '../../../../shared/mvt/use-district.js';
import { buildMvtFeaturePopupElement } from '../../../../shared/mvt/mvt-feature-popup.js';
import { MeshUtils } from '../model/mesh-utils.js';
import { layerKindFromMapLayerId } from '../../../../shared/mvt/feature-inspect.js';
import {
  geoJsonGeometryOverlapsFootprint,
  footprintsFromGeoJsonGeometry
} from '../../../../shared/geo/polygon-overlap-lonlat.js';
import {
  dedupeRenderedFeaturesById,
  pickRenderedFeature
} from '../../../../shared/mvt/rendered-feature-dedup.js';
import { Model } from '../model/model.js';
import { createIndexedMvtProtocol } from './indexed-mvt-protocol.js';

const EMPTY_FEATURE_COLLECTION = Object.freeze({ type: 'FeatureCollection', features: [] });

function regionBoundaryLineLayerIds() {
  return BOUNDARY_LAYERS.map(layer => `region-boundary-${layer.id}-line`);
}
const BASEMAP_SOURCE_ID = 'basemap-raster';
const BASEMAP_LAYER_ID = 'basemap-raster';

const OVERLAY_IDS = Object.freeze({
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
    this.layerIds = { luse: [], road: [], useDistrict: [] };
    this.fillLayerIds = { luse: [], road: [], useDistrict: [] };
    this.meshMarkers = [];
    this.webTileMarkers = [];
    this.webTileLabelGeneration = 0;
    this.meshOverlayKey = '';
    this.webTileOverlayKey = '';
    this.requestUrls = new Set();
    this.transferredBytes = 0;
    this.sourceErrors = new Set();
    this.selectedFeatureTargets = [];
    this.clickPopup = null;
    this.basemap = DEFAULT_BASEMAP;
    this.dedupeFeaturesById = true;
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
      center: [DEFAULT_VIEWER_LOCATION.longitude, DEFAULT_VIEWER_LOCATION.latitude],
      zoom: 16.2,
      bearing: 0,
      pitch: 0,
      minZoom: 5,
      maxZoom: 19,
      minPitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      hash: true,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          [BASEMAP_SOURCE_ID]: {
            type: 'raster',
            tiles: [...DEFAULT_BASEMAP.tiles],
            tileSize: DEFAULT_BASEMAP.tileSize,
            minzoom: DEFAULT_BASEMAP.minzoom,
            maxzoom: DEFAULT_BASEMAP.maxzoom,
            attribution: DEFAULT_BASEMAP.attribution
          }
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#e7e9e4' } },
          {
            id: BASEMAP_LAYER_ID,
            type: 'raster',
            source: BASEMAP_SOURCE_ID,
            paint: { 'raster-opacity': 1 }
          }
        ]
      }
    });

    this.map.addControl(
      new this.maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
      'top-right'
    );
    this.map.addControl(new this.maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    this.map.dragRotate?.disable?.();
    this.map.touchZoomRotate?.disableRotation?.();
    this.map.touchPitch?.disable?.();

    this.map.on('load', () => {
      this.enforceFlatView();
      this.ready = true;
      this.ensureOverlayLayers();
      if (this.pendingState) this.sync(this.pendingState);
      this.emitViewport();
      this.observeResources();
      this.callbacks.onStatus(`${Model.CONFIG.dataYear}年度 PLATEAU MVT 接続済み`, 'ready');
    });

    this.map.on('moveend', () => {
      this.enforceFlatView();
      this.emitViewport();
    });
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
        this.mvtSourcesPromise = this.syncMvtSources()
          .then(summary => {
            if (summary?.useDistrictLayerCount === 0) {
              this.callbacks.onStatus(
                '用途地域なし — `npm run build:mvt-index:use-district` を実行してください',
                'error'
              );
            }
          })
          .catch(error => {
            console.error('[map] syncMvtSources', error);
            this.callbacks.onStatus(error.message, 'error');
          })
          .finally(() => {
            this.mvtSourcesReady = true;
            if (this.pendingState) this.syncMvtStyle(this.pendingState);
            this.sync(this.pendingState);
          });
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

  setBasemap(basemap) {
    if (!basemap?.tiles?.length || !this.map) return;
    this.basemap = basemap;
    if (!this.ready) return;

    if (this.map.getLayer(BASEMAP_LAYER_ID)) this.map.removeLayer(BASEMAP_LAYER_ID);
    if (this.map.getSource(BASEMAP_SOURCE_ID)) this.map.removeSource(BASEMAP_SOURCE_ID);

    this.map.addSource(BASEMAP_SOURCE_ID, {
      type: 'raster',
      tiles: [...basemap.tiles],
      tileSize: basemap.tileSize,
      minzoom: basemap.minzoom,
      maxzoom: basemap.maxzoom,
      attribution: basemap.attribution
    });

    const beforeId = this.map.getStyle().layers.find(layer => layer.id !== 'background')?.id;
    this.map.addLayer(
      {
        id: BASEMAP_LAYER_ID,
        type: 'raster',
        source: BASEMAP_SOURCE_ID,
        paint: { 'raster-opacity': 1 }
      },
      beforeId
    );
  }

  /** 常に真上からの 2D（URL hash に傾きが残っていてもリセット） */
  enforceFlatView() {
    if (!this.map) return;
    const bearing = this.map.getBearing();
    const pitch = this.map.getPitch();
    if (Math.abs(bearing) < 0.01 && Math.abs(pitch) < 0.01) return;
    this.map.jumpTo({ bearing: 0, pitch: 0 });
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
    for (const layer of BOUNDARY_LAYERS) {
      const sourceId = `region-boundary-${layer.id}`;
      map.addSource(sourceId, {
        type: 'geojson',
        data: layer.url
      });
      map.addLayer({
        id: `${sourceId}-line`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': layer.boundaryColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 1.8, 18, 3],
          'line-opacity': 0.9,
          'line-dasharray': layer.dasharray
        }
      });
    }
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

    const primary = [
      { kind: 'luse', datasetId: 'luse-2025', sourceLayer: 'luse', required: true },
      { kind: 'road', datasetId: 'tran-lod1-2025', sourceLayer: 'Road', required: true }
    ];
    const luseCodes = await this.loadMvtDefinitionCities(primary[0]);
    await this.loadMvtDefinitionCities(primary[1]);

    const useDistrictDef = {
      kind: 'useDistrict',
      datasetId: USE_DISTRICT_DATASET_ID,
      sourceLayer: 'UseDistrict',
      required: false
    };
    let useDistrictLayerCount = 0;
    try {
      const manifest = await this.indexedMvt.loadManifest(USE_DISTRICT_DATASET_ID);
      const cities = luseCodes.size
        ? manifest.cities.filter(city => luseCodes.has(city.cityCode))
        : manifest.cities;
      useDistrictLayerCount = await this.loadMvtDefinitionCities(useDistrictDef, cities);
    } catch (error) {
      console.warn('用途地域 manifest 未生成:', error.message);
    }

    this.reorderMvtLayersForPick();
    this.bringOverlaysToFront();
    return { useDistrictLayerCount };
  }

  /** 描画・クリック: urf を下、luse を上（道路はその間） */
  reorderMvtLayersForPick() {
    const stackOrder = ['useDistrict', 'road', 'luse'];
    for (const kind of stackOrder) {
      for (const id of this.layerIds[kind] ?? []) {
        if (this.map.getLayer(id)) this.map.moveLayer(id);
      }
    }
  }

  /** @returns {Promise<number>} 追加した fill レイヤ数 */
  async loadMvtDefinitionCities(definition, citiesOverride = null) {
    let manifest;
    try {
      manifest = await this.indexedMvt.loadManifest(definition.datasetId);
    } catch (error) {
      if (definition.required) throw error;
      console.warn(`${definition.datasetId}:`, error.message);
      return 0;
    }
    const cities = citiesOverride ?? manifest.cities;
    let added = 0;
    for (const city of cities) {
      try {
        this.addMvtCity(definition, city.cityCode);
        if (definition.kind === 'useDistrict') added += 1;
      } catch (error) {
        console.warn(`MVTレイヤ追加スキップ ${definition.kind}/${city.cityCode}:`, error.message);
      }
    }
    if (definition.kind === 'luse') {
      return new Set(cities.map(city => city.cityCode));
    }
    return added;
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
    const isUseDistrict = kind === 'useDistrict';
    const defaultFill = isLuse
      ? maplibreLuseFillColorExpression()
      : isUseDistrict
        ? '#c084fc'
        : '#ffc85a';
    const defaultOpacity = isLuse ? 0.46 : isUseDistrict ? 0.38 : 0.58;
    const defaultLine = isLuse ? '#116d54' : isUseDistrict ? '#6d28d9' : '#7f5c12';
    this.map.addLayer({
        id: fill,
        type: 'fill',
        source,
        'source-layer': sourceLayer,
        minzoom: Model.CONFIG.mvtMinZoom,
        paint: {
          'fill-color': this.selectedAwareValue('#ff4d8d', defaultFill),
          'fill-opacity': this.featureOpacity(defaultOpacity, 0.78)
        }
    });
    this.map.addLayer({
        id: line,
        type: 'line',
        source,
        'source-layer': sourceLayer,
        minzoom: Model.CONFIG.mvtMinZoom,
        paint: {
          'line-color': this.selectedAwareValue('#ffffff', defaultLine),
          'line-width': this.selectedAwareValue(3.2, ['interpolate', ['linear'], ['zoom'], 14, isUseDistrict ? 0.55 : isLuse ? 0.5 : 0.6, 17, isUseDistrict ? 1.5 : isLuse ? 1.4 : 1.6]),
          'line-opacity': this.featureOpacity(isUseDistrict ? 0.88 : isLuse ? 0.84 : 0.9, 1)
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
    this.layerIds = { luse: [], road: [], useDistrict: [] };
    this.fillLayerIds = { luse: [], road: [], useDistrict: [] };
  }

  syncMvtStyle(state) {
    const defaultOpacity = { luse: 0.46, road: 0.58, useDistrict: 0.38 };
    for (const kind of ['luse', 'road', 'useDistrict']) {
      const visible = state.visibility?.[kind] !== false;
      const visibility = visible ? 'visible' : 'none';
      this.layerIds[kind].forEach(id => {
        if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visibility);
      });
      const baseOpacity = state.opacity?.[kind] ?? defaultOpacity[kind];
      const opacity = this.featureOpacity(baseOpacity, 0.78);
      this.fillLayerIds[kind].forEach(id => {
        if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'fill-opacity', opacity);
      });
    }
  }

  syncCityBoundaryStyle(visible) {
    for (const lineId of regionBoundaryLineLayerIds()) {
      if (!this.map.getLayer(lineId)) continue;
      this.map.setLayoutProperty(lineId, 'visibility', visible ? 'visible' : 'none');
    }
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
        const unionCodes = [...new Set([...luse, ...road])].sort();
        const cityLabel = unionCodes.length ? unionCodes.join(',') : '—';
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
      ...regionBoundaryLineLayerIds()
    ].forEach(id => {
      if (this.map.getLayer(id)) this.map.moveLayer(id);
    });
  }

  interactiveLayerIds() {
    return [
      ...this.fillLayerIds.luse,
      ...this.fillLayerIds.useDistrict,
      ...this.fillLayerIds.road
    ].filter(id => this.map.getLayer(id));
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
    const raw = layers.length
      ? this.visibleRenderedFeatures(this.map.queryRenderedFeatures(event.point, { layers }))
      : [];
    const { feature, debug } = pickRenderedFeature(raw, {
      dedupe: this.dedupeFeaturesById,
      layerKindFromId: Model.layerKindFromId
    });
    if (!feature) {
      this.clearSelectedFeature();
      this.callbacks.onFeatureSelected(null);
      return;
    }
    const layerId = feature.layer.id;
    const kind = layerKindFromMapLayerId(layerId);
    const overlappingUseDistricts =
      kind === 'luse' ? this.findUseDistrictFeaturesOverlappingLuse(feature) : [];
    this.selectFeaturesOnMap(feature, overlappingUseDistricts);
    this.callbacks.onFeatureSelected({
      ...feature,
      overlappingUseDistricts: overlappingUseDistricts.map(entry => ({ ...entry.properties }))
    });

    this.showClickPopup(event.lngLat, kind, feature.properties, overlappingUseDistricts);
  }

  showClickPopup(lngLat, kind, properties, overlappingUseDistricts = []) {
    this.clickPopup?.remove();
    this.clickPopup = null;

    const popup = buildMvtFeaturePopupElement(document, {
      kind,
      properties,
      overlappingUseDistricts: overlappingUseDistricts.map(entry => ({ ...entry.properties }))
    }, { showClose: false });

    this.clickPopup = new this.maplibregl.Popup({
      closeButton: true,
      maxWidth: '320px',
      className: 'plateau-mvt-popup'
    })
      .setLngLat(lngLat)
      .setDOMContent(popup)
      .addTo(this.map);
    this.clickPopup.on('close', () => {
      if (this.clickPopup) this.clickPopup = null;
    });
  }

  visibleRenderedFeatures(features) {
    return features;
  }

  findUseDistrictFeaturesOverlappingLuse(luseFeature) {
    const parts = footprintsFromGeoJsonGeometry(luseFeature?.geometry);
    if (!parts.length) return [];
    const layers = this.fillLayerIds.useDistrict.filter(id => this.map.getLayer(id));
    if (!layers.length) return [];
    const canvas = this.map.getCanvas();
    const raw = this.map.queryRenderedFeatures(
      [[0, 0], [canvas.width, canvas.height]],
      { layers }
    );
    const pool = dedupeRenderedFeaturesById(raw, Model.layerKindFromId);
    const hits = [];
    for (const urf of pool) {
      for (const part of parts) {
        if (geoJsonGeometryOverlapsFootprint(urf.geometry, part)) {
          hits.push(urf);
          break;
        }
      }
    }
    return hits;
  }

  featureStateTarget(feature) {
    if (feature?.id === undefined || feature?.id === null) return null;
    const target = {
      source: feature.source,
      sourceLayer: feature.sourceLayer,
      id: feature.id
    };
    if (!target.source || !target.sourceLayer || !this.map.getSource(target.source)) return null;
    return target;
  }

  selectFeaturesOnMap(primary, related = []) {
    this.clearSelectedFeature();
    const targets = [];
    for (const feature of [primary, ...related]) {
      const target = this.featureStateTarget(feature);
      if (!target) continue;
      this.map.setFeatureState(target, { selected: true });
      targets.push(target);
    }
    this.selectedFeatureTargets = targets;
  }

  clearSelectedFeature() {
    const targets = this.selectedFeatureTargets ?? [];
    this.selectedFeatureTargets = [];
    for (const target of targets) {
      if (!target || !this.map?.getSource(target.source)) continue;
      this.map.removeFeatureState(target, 'selected');
    }
  }

  handleMapError(event) {
    const sourceId = event?.sourceId;
    const message = event?.error?.message || 'データを読み込めませんでした';
    if (sourceId === BASEMAP_SOURCE_ID) {
      this.callbacks.onStatus('背景地図を読み込めませんでした', 'error');
    } else if (sourceId?.startsWith('region-boundary-')) {
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

  async searchAddress(query) {
    const result = await geocodeAddress(query);
    if (!this.map) return result;

    const zoom = mapZoomForAddressMatch(result.matchDepth, Model.CONFIG.mvtMinZoom);
    this.map.flyTo({
      center: [result.longitude, result.latitude],
      zoom,
      bearing: 0,
      pitch: 0,
      duration: 1600,
      essential: true
    });
    return result;
  }
}


