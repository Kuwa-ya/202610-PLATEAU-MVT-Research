/**
 * B.4 — 選択 luse footprint と交差する用途地域（loaded MVT シーン）
 */

import { polygonFootprintsOverlapLonLat } from '../geo/polygon-overlap-lonlat.js';
import { isMvtSceneNodeVisible } from './mvt-scene-pick.js';
import { mvtFeatureId } from './rendered-feature-dedup.js';

const USE_DISTRICT_DATASET = 'use-district-2025';

/**
 * @param {import('three').Object3D} root
 * @param {{ outer: [number, number][], holes?: [number, number][][] }} luseFootprint
 * @returns {Array<{ datasetId: string, properties: object, vertices: number }>}
 */
export function findUseDistrictPicksOverlappingFootprint(root, luseFootprint) {
  if (!root || !luseFootprint?.outer?.length) return [];

  const bestById = new Map();

  root.traverse(node => {
    if (!node.isMesh || !node.userData?.mvtPick?.footprint) return;
    if (!isMvtSceneNodeVisible(node)) return;
    const pick = node.userData.mvtPick;
    if (pick.datasetId !== USE_DISTRICT_DATASET) return;
    if (!polygonFootprintsOverlapLonLat(luseFootprint, pick.footprint)) return;

    const id = mvtFeatureId(pick.properties);
    const key = id ?? `mesh:${node.uuid}`;
    const vertices = pick.vertices ?? 0;
    const prev = bestById.get(key);
    if (!prev || vertices > prev.vertices) {
      bestById.set(key, {
        datasetId: pick.datasetId,
        properties: { ...pick.properties },
        vertices
      });
    }
  });

  return [...bestById.values()].sort((a, b) =>
    String(mvtFeatureId(a.properties) ?? '').localeCompare(String(mvtFeatureId(b.properties) ?? ''))
  );
}
