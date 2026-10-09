/**
 * 【役割】ViewModel の `layers` 状態を Leaflet レイヤへ同期する（地図描画の集約点）。
 * 【レイヤ】View helper（View配下）
 * 【依存】`LeafletMapAdapter`
 * 【公開】`syncGeoJsonLayers(map, layers, handlers)`
 * 【補足】ViewModel は Leaflet を import しない。地図同期はここに隔離する。
 */
import { LeafletMapAdapter } from "../services/LeafletMapAdapter.js";

const DEFAULT_MAX_LABELS = 1800;

/**
 * View 側: ViewModel の layers 状態を Leaflet に反映する（ViewModel は地図を知らない）。
 * @param {LeafletMapAdapter} map
 * @param {Array<{ id: string, name: string, visible: boolean, filtered: any, colorKey?: string | null, colorizer?: { key: string, colorForFeature: (f: any) => string } | null }>} layers
 * @param {{ onFeatureClick: (layerId: string, feature: any) => void, labelKeys?: string[] }} handlers
 */
export function syncGeoJsonLayers(map, layers, { onFeatureClick, labelKeys = [], selectedFeature = null }) {
  // ViewModel の状態に存在しない地図レイヤは削除して整合を保つ。
  const keep = new Set(layers.map((l) => l.id));
  for (const id of map.getGeoJsonLayerIds()) {
    if (!keep.has(id)) map.removeLayer(id);
  }

  for (const layer of layers) {
    const onEachFeature = (feature, leafletLayer) => {
      leafletLayer.on("click", () => onFeatureClick(layer.id, feature));
    };

    if (layer.colorKey && layer.colorizer && layer.colorizer.key === layer.colorKey) {
      const { colorForFeature } = layer.colorizer;
      map.upsertGeoJsonLayer({
        layerId: layer.id,
        geojson: layer.filtered,
        style: (feature) => {
          const c = colorForFeature(feature);
          return { color: c, weight: 2.5, opacity: 0.95, fillColor: c, fillOpacity: 0.5 };
        },
        pointToLayer: (feature, latlng) => {
          const c = colorForFeature(feature);
          return map.createCircleMarker(latlng, {
            radius: 6,
            color: c,
            weight: 2.5,
            opacity: 0.95,
            fillOpacity: 0.9,
            fillColor: c,
          });
        },
        onEachFeature,
      });
    } else {
      map.upsertGeoJsonLayer({
        layerId: layer.id,
        geojson: layer.filtered,
        onEachFeature,
      });
    }

    map.setLayerVisible(layer.id, layer.visible);
  }

  map.syncViewportLabels({
    layerIds: layers.map((l) => l.id),
    labelKeys,
    maxLabels: DEFAULT_MAX_LABELS,
    selectedFeature,
  });
}
