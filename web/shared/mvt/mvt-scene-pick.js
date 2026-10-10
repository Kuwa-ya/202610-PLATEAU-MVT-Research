/**
 * Three.js MVT クリック — 2D MapLibre の pickRenderedFeature と同方針
 */

import { pointInPolygonLonLat } from '../geo/point-in-ring.js';
import { layerKindFromDatasetId } from './feature-inspect.js';
import { mvtFeatureId } from './rendered-feature-dedup.js';

/** 塗り順の近似（上にあるほど先に選ぶ） */
const KIND_PICK_RANK = { road: 0, useDistrict: 1, luse: 2 };

export function mvtPickKindRank(datasetId) {
  const kind = layerKindFromDatasetId(datasetId);
  return KIND_PICK_RANK[kind] ?? 3;
}

/**
 * @param {Array<{ pick: object, mesh: object, distance?: number }>} candidates
 */
export function chooseMvtPickCandidate(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (!list.length) return null;

  const bestByKey = new Map();
  for (const entry of list) {
    const kind = layerKindFromDatasetId(entry.pick?.datasetId);
    const id = mvtFeatureId(entry.pick?.properties);
    const key =
      id != null ? `${kind}:id:${id}` : `${kind}:mesh:${entry.mesh?.uuid ?? ''}`;
    const vertices = entry.pick?.vertices ?? 0;
    const prev = bestByKey.get(key);
    if (!prev || vertices > (prev.pick?.vertices ?? 0)) {
      bestByKey.set(key, entry);
    }
  }

  const pool = [...bestByKey.values()];
  pool.sort((a, b) => {
    const ra = mvtPickKindRank(a.pick.datasetId);
    const rb = mvtPickKindRank(b.pick.datasetId);
    if (ra !== rb) return ra - rb;
    return (a.distance ?? 0) - (b.distance ?? 0);
  });
  return pool[0] ?? null;
}

export function isMvtSceneNodeVisible(node) {
  let current = node;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

/**
 * @param {import('three').Object3D} root
 */
export function mvtPickCandidatesAtLonLat(root, lon, lat) {
  const candidates = [];
  root.traverse(node => {
    if (!node.isMesh || !node.userData?.mvtPick?.footprint) return;
    if (!isMvtSceneNodeVisible(node)) return;
    const { outer, holes } = node.userData.mvtPick.footprint;
    if (!pointInPolygonLonLat(lon, lat, outer, holes ?? [])) return;
    candidates.push({
      pick: node.userData.mvtPick,
      mesh: node,
      distance: 0
    });
  });
  return candidates;
}
