/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { MVT_FLAT_Y } from './mvt-drape.js';
import {
  chooseMvtPickCandidate,
  isMvtSceneNodeVisible,
  mvtPickCandidatesAtLonLat
} from '../../../../shared/mvt/mvt-scene-pick.js';
import { mvtFeatureId } from '../../../../shared/mvt/rendered-feature-dedup.js';

const HIGHLIGHT_COLOR = 0xff4d8d;
const _plane = { normal: null, constant: 0 };

function collectRayCandidates(hits) {
  const candidates = [];
  for (const hit of hits) {
    let node = hit.object;
    while (node) {
      if (node.userData?.mvtPick && isMvtSceneNodeVisible(node)) {
        candidates.push({
          pick: node.userData.mvtPick,
          mesh: hit.object,
          distance: hit.distance
        });
        break;
      }
      node = node.parent;
    }
  }
  return candidates;
}

function lonLatFromClientRay(THREE, ray, origin) {
  const latRad = (origin.lat * Math.PI) / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(latRad);
  if (!_plane.normal) _plane.normal = new THREE.Vector3(0, 1, 0);
  _plane.constant = -MVT_FLAT_Y;
  const plane = new THREE.Plane(_plane.normal, _plane.constant);
  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(plane, hit)) return null;
  return {
    lon: origin.lon + hit.x / metersPerDegLon,
    lat: origin.lat - hit.z / metersPerDegLat
  };
}

/**
 * レイキャスト → 失敗時は MVT 平面へ投影して 2D 同様の点-in-ポリゴン
 * @param {{ lat: number, lon: number }} origin
 * @returns {{ pick: { datasetId: string, properties: object }, mesh: import('three').Mesh } | null}
 */
export function pickMvtAt(THREE, root, camera, canvas, clientX, clientY, origin) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x, y }, camera);
  const hits = raycaster.intersectObject(root, true);

  let chosen = chooseMvtPickCandidate(collectRayCandidates(hits));
  if (!chosen && origin?.lat != null && origin?.lon != null) {
    const lonLat = lonLatFromClientRay(THREE, raycaster.ray, origin);
    if (lonLat) {
      chosen = chooseMvtPickCandidate(
        mvtPickCandidatesAtLonLat(root, lonLat.lon, lonLat.lat)
      );
    }
  }
  if (!chosen) return null;
  return { pick: chosen.pick, mesh: chosen.mesh };
}

function pickMatchesHighlight(pick, entry) {
  if (!entry) return false;
  if (pick.datasetId !== entry.datasetId) return false;
  const selectedId = mvtFeatureId(entry.properties);
  const id = mvtFeatureId(pick.properties);
  if (selectedId == null) return pick.properties === entry.properties;
  return id === selectedId;
}

/**
 * @param {{ datasetId: string, properties: object } | null} selectedPick
 * @param {Array<{ datasetId: string, properties: object }>} [relatedPicks]
 */
export function applyMvtSelectionHighlight(root, selectedPick, relatedPicks = []) {
  const related = Array.isArray(relatedPicks) ? relatedPicks : [];

  root.traverse(node => {
    if (!node.isMesh || !node.userData?.mvtPick) return;
    const material = node.material;
    if (!material || Array.isArray(material)) return;
    if (material.userData.mvtBaseColor == null) {
      material.userData.mvtBaseColor = material.color.getHex();
      material.userData.mvtBaseOpacity = material.opacity;
    }
    const pick = node.userData.mvtPick;
    const isSelected =
      pickMatchesHighlight(pick, selectedPick)
      || related.some(entry => pickMatchesHighlight(pick, entry));

    if (isSelected) {
      material.color.setHex(HIGHLIGHT_COLOR);
      material.opacity = Math.min(1, (material.userData.mvtBaseOpacity ?? 0.5) + 0.22);
    } else {
      material.color.setHex(material.userData.mvtBaseColor);
      material.opacity = material.userData.mvtBaseOpacity;
    }
  });
}

/** @param {import('three').Object3D} root */
export function mvtPickHoverAt(THREE, root, camera, canvas, clientX, clientY, origin) {
  return Boolean(pickMvtAt(THREE, root, camera, canvas, clientX, clientY, origin));
}
