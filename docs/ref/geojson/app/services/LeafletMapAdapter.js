/**
 * 【役割】Leaflet への依存を隔離し、地図操作（初期化・レイヤupsert・可視/削除・ズーム）を提供する。
 * 【レイヤ】Adapter（外部ライブラリ境界）
 * 【依存】Leaflet（`L`）
 * 【公開】`LeafletMapAdapter` クラス
 * 【補足】ViewModel から直接参照しない（View側でのみ利用する）。
 */
import { getPropertyValueByPath } from "../model/geoJsonHelpers.js";
import { meshBounds, meshCodeFromLatLon, meshCodesForBounds } from "../model/japanMesh.js";
import { latLonToTile, tileBounds } from "../model/webMesh.js";

export class LeafletMapAdapter {
  /**
   * @param {any} L - Leaflet global
   * @param {string} containerId
   */
  constructor(L, containerId) {
    this.L = L;
    this.containerId = containerId;

    this.map = null;
    this.baseLayer = null;
    this.baseLayers = {};
    this.baseLayerType = null;
    // ViewModel の layerId と Leaflet の実体を対応付ける（地図の状態はここに集約）。
    this.geojsonLayers = new Map(); // layerId -> { group, geojson, bounds, featureLayerMap }
    // 現在ハイライト中の Leaflet レイヤと元スタイル
    this._highlighted = null; // { leafletLayer, originalOptions }
    this.meshLayer = null;
    this.webTileLayer = null;
  }

  createCircleMarker(latlng, options) {
    return this.L.circleMarker(latlng, options);
  }

  initialize() {
    const { L } = this;
    this.map = L.map(this.containerId, {
      zoomControl: true,
      preferCanvas: true,
      maxZoom: 22,
    }).setView([35.681236, 139.767125], 14);

    // 地理院タイル（標準地図）
    const options = { maxNativeZoom: 18, maxZoom: 22, attribution: "国土地理院" };
    const gsi = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
      // 地理院タイル自体の提供上限は通常18。超える場合はタイルを拡大表示（粗くなる）。
      maxNativeZoom: 18,
      maxZoom: 22,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
    });
    this.baseLayers = {
      "gsi-standard": gsi,
      "gsi-pale": L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", options),
      osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { ...options, attribution: "© OpenStreetMap contributors" }),
    };
    gsi.addTo(this.map);
    this.baseLayer = gsi;
    this.baseLayerType = "gsi-standard";
    this.meshLayer = this.L.layerGroup().addTo(this.map);
    this.webTileLayer = this.L.layerGroup().addTo(this.map);
  }

  syncMeshLayer({ enabled = true, digits = 8, codes = [], activeCode = null, onSelect = null }) {
    if (!this.meshLayer) return;
    this.meshLayer.clearLayers();
    if (!enabled) return;
    for (const code of codes) {
      const b = meshBounds(code);
      const selected = code === activeCode;
      const rectangle = this.L.rectangle([[b.south, b.west], [b.north, b.east]], {
        color: selected ? "#fbbf24" : "#2563eb",
        weight: selected ? 3 : 1,
        fillColor: selected ? "#f59e0b" : "#3b82f6",
        fillOpacity: selected ? 0.26 : 0.04,
        interactive: true,
      }).addTo(this.meshLayer);
      rectangle.on("click", () => onSelect?.(code));
      this.L.marker([(b.south + b.north) / 2, (b.west + b.east) / 2], {
        interactive: false,
        icon: this.L.divIcon({
          className: `mesh-label mesh-label-${digits}`,
          html: `<span>${code}</span>`,
          iconSize: [112, 28],
          iconAnchor: [56, 14],
        }),
      }).addTo(this.meshLayer);
    }
  }

  getMeshViewportState() {
    if (!this.map) return { digits: 8, codes: [], centerCode: null };
    const zoom = this.map.getZoom();
    const digits = zoom >= 18 ? 11 : zoom >= 17 ? 10 : zoom >= 16 ? 9 : zoom >= 14 ? 8 : zoom >= 10 ? 6 : 4;
    const limit = digits === 4 ? 2000 : digits === 6 ? 2500 : digits === 8 ? 600 : digits === 9 ? 900 : digits === 10 ? 1500 : 2500;
    const b = this.map.getBounds();
    const japanBounds = {
      south: Math.max(20, b.getSouth()),
      west: Math.max(122, b.getWest()),
      north: Math.min(46, b.getNorth()),
      east: Math.min(154, b.getEast()),
    };
    const codes = meshCodesForBounds(japanBounds, limit, digits);
    const c = this.map.getCenter();
    const centerInJapan = c.lat >= 20 && c.lat <= 46 && c.lng >= 122 && c.lng <= 154;
    return { digits, codes, centerCode: centerInJapan ? meshCodeFromLatLon(c.lat, c.lng, digits) : null };
  }

  getWebTileViewportState() {
    if (!this.map) return { zoom: 0, tiles: [] };
    const z = this.map.getZoom(); const b = this.map.getBounds();
    const nw = latLonToTile(b.getNorth(), b.getWest(), z); const se = latLonToTile(b.getSouth(), b.getEast(), z);
    const tiles = []; const max = 2 ** z;
    for (let y = Math.max(0, nw.y); y <= Math.min(max - 1, se.y); y += 1) for (let x = nw.x; x <= se.x; x += 1) tiles.push({ z, x: ((x % max) + max) % max, y });
    return { zoom: z, tiles: tiles.slice(0, 400) };
  }

  syncWebTileLayer({ enabled = false, tiles = [] }) {
    if (!this.webTileLayer) return;
    this.webTileLayer.clearLayers(); if (!enabled) return;
    for (const tile of tiles) {
      const b = tileBounds(tile.x, tile.y, tile.z);
      this.L.rectangle([[b.south, b.west], [b.north, b.east]], { color: "#dc2626", weight: 1, fill: false, interactive: false }).addTo(this.webTileLayer);
      this.L.marker([(b.south + b.north) / 2, (b.west + b.east) / 2], {
        interactive: false,
        icon: this.L.divIcon({
          className: "web-tile-label",
          html: `<span>${tile.z}/${tile.x}/${tile.y}</span>`,
          iconSize: [140, 28],
          iconAnchor: [70, 14],
        }),
      }).addTo(this.webTileLayer);
    }
  }

  setBasemapEnabled(enabled) {
    if (!this.map || !this.baseLayer) return;
    if (enabled) {
      if (!this.map.hasLayer(this.baseLayer)) this.baseLayer.addTo(this.map);
    } else {
      if (this.map.hasLayer(this.baseLayer)) this.map.removeLayer(this.baseLayer);
    }
  }

  setBasemapType(type) {
    if (!this.map) return;
    if (type === this.baseLayerType && this.baseLayer && this.map.hasLayer(this.baseLayer)) return;
    for (const layer of Object.values(this.baseLayers)) if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    const next = this.baseLayers[type] ?? this.baseLayers["gsi-standard"];
    this.baseLayer = next;
    this.baseLayerType = type;
    next.addTo(this.map);
  }

  /**
   * 動作: 地図の表示範囲変更（moveend/zoomend）イベントを購読する。
   * @param {() => void} listener
   * @returns {() => void} unsubscribe
   */
  onViewportChanged(listener) {
    if (!this.map) return () => {};
    this.map.on("moveend", listener);
    this.map.on("zoomend", listener);
    return () => {
      if (!this.map) return;
      this.map.off("moveend", listener);
      this.map.off("zoomend", listener);
    };
  }

  upsertGeoJsonLayer({ layerId, geojson, style, pointToLayer, onEachFeature }) {
    const { L } = this;
    if (!this.map) throw new Error("地図が初期化されていません。");

    // remove old
    const existing = this.geojsonLayers.get(layerId);
    if (existing) {
      this.map.removeLayer(existing.group);
      this.geojsonLayers.delete(layerId);
    }

    const featureLayerMap = new Map();
    const wrappedOnEachFeature = (feat, leafletLayer) => {
      featureLayerMap.set(feat, leafletLayer);
      onEachFeature?.(feat, leafletLayer);
    };

    const group = L.geoJSON(geojson, {
      style:
        style ??
        (() => ({
          color: "#6ea8ff",
          weight: 2.5,
          opacity: 0.95,
          fillColor: "#6ea8ff",
          fillOpacity: 0.4,
        })),
      pointToLayer:
        pointToLayer ??
        ((_feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            color: "#43d18d",
            weight: 2.5,
            opacity: 0.95,
            fillOpacity: 0.9,
            fillColor: "#43d18d",
          })),
      onEachFeature: wrappedOnEachFeature,
    });

    group.addTo(this.map);

    let bounds = null;
    try {
      bounds = group.getBounds();
      if (bounds && bounds.isValid()) {
        // no-op
      } else {
        bounds = null;
      }
    } catch {
      bounds = null;
    }

    this.geojsonLayers.set(layerId, { group, geojson, bounds, featureLayerMap });
  }

  /**
   * 動作: 指定フィーチャの Leaflet レイヤをハイライトする（スタイル変更）。
   * @param {string} layerId
   * @param {any} feature - GeoJSON feature オブジェクト（参照一致で照合）
   */
  highlightFeature(layerId, feature) {
    this.clearHighlight();
    const entry = this.geojsonLayers.get(layerId);
    const leafletLayer = entry?.featureLayerMap?.get(feature);
    if (!leafletLayer) return;

    const originalOptions = { ...leafletLayer.options };
    if (typeof leafletLayer.setStyle === "function") {
      leafletLayer.setStyle({ color: "#ffcc00", weight: 4, fillOpacity: 0.65, opacity: 1 });
      leafletLayer.bringToFront?.();
    }
    this._highlighted = { leafletLayer, originalOptions };
  }

  /**
   * 動作: ハイライト中のフィーチャのスタイルを元に戻す。
   */
  clearHighlight() {
    if (!this._highlighted) return;
    const { leafletLayer, originalOptions } = this._highlighted;
    this._highlighted = null;
    if (typeof leafletLayer.setStyle === "function") {
      leafletLayer.setStyle(originalOptions);
    }
  }

  setLayerVisible(layerId, visible) {
    if (!this.map) return;
    const entry = this.geojsonLayers.get(layerId);
    if (!entry) return;
    const has = this.map.hasLayer(entry.group);
    if (visible && !has) entry.group.addTo(this.map);
    if (!visible && has) this.map.removeLayer(entry.group);
  }

  removeLayer(layerId) {
    if (!this.map) return;
    const entry = this.geojsonLayers.get(layerId);
    if (!entry) return;
    this.map.removeLayer(entry.group);
    this.geojsonLayers.delete(layerId);
  }

  zoomToLayer(layerId) {
    if (!this.map) return;
    const entry = this.geojsonLayers.get(layerId);
    if (!entry?.bounds) return;
    this.map.fitBounds(entry.bounds.pad(0.08));
  }

  /** @returns {string[]} */
  getGeoJsonLayerIds() {
    return [...this.geojsonLayers.keys()];
  }

  /**
   * 動作: 現在の表示範囲内にあるフィーチャだけラベルを付与する。
   * 既存の tooltip は必要に応じて更新/解除し、最大表示件数を超えるラベルは描画しない。
   * @param {{ layerIds: string[], labelKeys: string[], maxLabels?: number }} params
   */
  syncViewportLabels({ layerIds, labelKeys, maxLabels = 1500, selectedFeature = null }) {
    if (!this.map) return;

    const keys = Array.isArray(labelKeys) ? labelKeys.filter(Boolean) : [];
    const ids = Array.isArray(layerIds) ? layerIds : this.getGeoJsonLayerIds();
    const bounds = this.map.getBounds().pad(0.04);

    let shown = 0;
    for (const layerId of ids) {
      const entry = this.geojsonLayers.get(layerId);
      if (!entry) continue;

      const isVisible = this.map.hasLayer(entry.group);
      entry.group.eachLayer((leafletLayer) => {
        const tooltip = leafletLayer.getTooltip?.();
        const inView = _isLeafletLayerInBounds(leafletLayer, bounds);

        if (!isVisible || !keys.length || !inView || shown >= maxLabels) {
          if (tooltip) leafletLayer.unbindTooltip();
          return;
        }

        const content = _buildLabelContent(leafletLayer.feature, keys);
        if (!content) {
          if (tooltip) leafletLayer.unbindTooltip();
          return;
        }

        shown += 1;

        const isSelected = selectedFeature != null && leafletLayer.feature === selectedFeature;
        const targetClass = isSelected ? "featureLabel featureLabel--selected" : "featureLabel";
        const targetOpacity = isSelected ? 1 : 0.95;

        if (
          tooltip &&
          tooltip.getContent() === content &&
          tooltip.options?.className === targetClass
        ) return;
        if (tooltip) leafletLayer.unbindTooltip();

        leafletLayer.bindTooltip(content, {
          permanent: true,
          direction: "center",
          className: targetClass,
          sticky: false,
          opacity: targetOpacity,
        });
      });
    }
  }
}

/**
 * GeoJSON feature から labelKeys 順で値のみの複数行テキストを組み立てる。
 * @param {any} feature
 * @param {string[]} labelKeys
 * @returns {string}
 */
function _buildLabelContent(feature, labelKeys) {
  const lines = [];
  for (const key of labelKeys) {
    const val = getPropertyValueByPath(feature?.properties, key);
    const text = _formatLabelValue(val);
    if (!text) continue;
    lines.push(text);
  }
  return lines.join("\n");
}

/**
 * ラベル表示用の値整形（配列は結合、object はJSON、長すぎる値は省略）。
 * @param {any} value
 * @returns {string}
 */
function _formatLabelValue(value) {
  if (value == null) return "";

  let out = "";
  if (Array.isArray(value)) {
    const items = value
      .map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        }
        return String(v);
      })
      .filter((s) => s !== "");
    out = items.join(" / ");
  } else if (typeof value === "object") {
    try {
      out = JSON.stringify(value);
    } catch {
      out = String(value);
    }
  } else {
    out = String(value);
  }

  if (out.length > 220) return `${out.slice(0, 217)}...`;
  return out;
}

/**
 * Leaflet レイヤが現在の地図表示範囲内か判定する。
 * @param {any} leafletLayer
 * @param {any} bounds
 * @returns {boolean}
 */
function _isLeafletLayerInBounds(leafletLayer, bounds) {
  try {
    if (typeof leafletLayer.getBounds === "function") {
      const b = leafletLayer.getBounds();
      return !!(b?.isValid?.() && bounds.intersects(b));
    }
    if (typeof leafletLayer.getLatLng === "function") {
      return bounds.contains(leafletLayer.getLatLng());
    }
  } catch {
    return false;
  }
  return false;
}
