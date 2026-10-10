/**
 * MVT デコード後 feature の gml_id 重複排除（MapLibre クリック照会と同方針）。
 */

import { mvtFeatureId } from './rendered-feature-dedup.js';

export { mvtFeatureId };

export function mvtFeatureVertexCount(feature) {
  const geom = feature?.geometry;
  if (!geom) return 0;
  if (feature.type === 3) {
    return geom.reduce((sum, ring) => sum + (ring?.length ?? 0), 0);
  }
  if (feature.type === 2) {
    return geom.reduce((sum, line) => sum + (line?.length ?? 0), 0);
  }
  return 0;
}

/** 1 タイル内 — 同一 ID は頂点数最大のみ残す */
export function dedupeMvtFeatures(features) {
  const list = Array.isArray(features) ? features : [];
  const bestById = new Map();
  const withoutId = [];

  for (const feature of list) {
    const id = mvtFeatureId(feature.properties);
    if (id == null) {
      withoutId.push(feature);
      continue;
    }
    const vertices = mvtFeatureVertexCount(feature);
    const prev = bestById.get(id);
    if (!prev || vertices > prev.vertices) {
      bestById.set(id, { feature, vertices });
    }
  }

  return [...[...bestById.values()].map(entry => entry.feature), ...withoutId];
}
