import { createFeature, createFeatureCollection, isFeature, isFeatureCollection } from "../../js/geojson/geojson-models.js";

export function normalizeToFeatureCollection(geojson) {
  if (!geojson || typeof geojson !== "object") throw new TypeError("GeoJSONが空です。");
  if (isFeatureCollection(geojson)) return geojson;
  if (isFeature(geojson)) return createFeatureCollection([geojson]);
  if (typeof geojson.type === "string" && ("coordinates" in geojson || geojson.type === "GeometryCollection")) {
    return createFeatureCollection([createFeature({ geometry: geojson })]);
  }
  throw new TypeError("未対応のGeoJSON構造です。");
}

export * from "../../js/geojson/geojson-utils.js";
