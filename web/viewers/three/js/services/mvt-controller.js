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

import { DATASETS, MVT_MAX_CAMERA_DISTANCE } from './mvt-config.js';
import { MVT_VIEWER_LAYERS } from '../../../../shared/mvt/viewer-mvt-layers.js';
import { decodeMvt } from './mvt-decode.js';
import { viewCenterFromTarget } from './local-frame.js';
import { planFetches } from './mvt-index.js';
import { dedupeMvtFeatures } from '../../../../shared/mvt/mvt-feature-dedup.js';
import { buildTileGroup, disposeObject3D } from './mvt-mesh.js';

const MAX_CONCURRENT = 4;
const MAX_TILES = 32;

export function createMvtController(THREE, scene, getCameraState) {
  const root = new THREE.Group();
  root.name = 'plateau-mvt-root';
  scene.add(root);
  const tileGroups = new Map();
  const datasetVisibility = new Map(
    MVT_VIEWER_LAYERS.map(layer => [layer.datasetId, layer.defaultVisible])
  );
  const datasetOpacity = new Map(
    MVT_VIEWER_LAYERS.map(layer => [layer.datasetId, layer.defaultOpacity])
  );
  let generation = 0;
  let activeAbortController = null;
  let lastError = '';

  function viewBounds(distance, center) {
    const spanDeg = Math.max(0.0015, (distance / 111_320) * 0.85);
    return {
      north: center.lat + spanDeg,
      south: center.lat - spanDeg,
      west: center.lon - spanDeg,
      east: center.lon + spanDeg
    };
  }

  function styleForDataset(datasetId) {
    const base = DATASETS.find(d => d.id === datasetId);
    if (!base) return { id: datasetId, opacity: 0.5, color: 0xffffff };
    return { ...base, opacity: datasetOpacity.get(datasetId) ?? base.opacity };
  }

  function applyOpacityToDataset(datasetId) {
    const opacity = datasetOpacity.get(datasetId);
    if (opacity == null) return;
    for (const group of tileGroups.values()) {
      if (group.userData.datasetId !== datasetId) continue;
      group.traverse(node => {
        const material = node.material;
        if (!material) return;
        if (Array.isArray(material)) material.forEach(m => { m.opacity = opacity; });
        else material.opacity = opacity;
      });
    }
  }

  async function fetchTile(plan, origin, datasetStyle, signal) {
    const response = await fetch(plan.url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    let { features, extent } = await decodeMvt(buffer, plan.sourceLayer);
    if (!features.length) throw new Error('地物 0 件');
    features = dedupeMvtFeatures(features);
    if (!features.length) throw new Error('地物 0 件（重複排除後）');
    const group = buildTileGroup(
      THREE, features, plan.x, plan.y, plan.z, origin, datasetStyle, extent
    );
    group.userData.featureCount = features.length;
    group.userData.datasetId = plan.datasetId;
    group.userData.cityCode = plan.cityCode;
    group.visible = datasetVisibility.get(plan.datasetId) !== false;
    let drawable = 0;
    group.traverse(node => {
      if (node.isMesh || node.isLine) drawable += 1;
    });
    if (!drawable) throw new Error('描画可能な地物 0 件（ジオメトリ変換を確認）');
    return group;
  }

  function clearTiles() {
    generation += 1;
    activeAbortController?.abort();
    activeAbortController = null;
    for (const group of tileGroups.values()) {
      root.remove(group);
      disposeObject3D(group);
    }
    tileGroups.clear();
  }

  function evictOutside(keepKeys) {
    for (const [key, group] of tileGroups) {
      if (keepKeys.has(key)) continue;
      root.remove(group);
      disposeObject3D(group);
      tileGroups.delete(key);
    }
  }

  function hasTiles() {
    return tileGroups.size > 0;
  }

  function hasDatasetTiles(datasetId) {
    for (const group of tileGroups.values()) {
      if (group.userData.datasetId === datasetId) return true;
    }
    return false;
  }

  function getVisibleTileCount() {
    let count = 0;
    for (const group of tileGroups.values()) {
      if (group.visible) count += 1;
    }
    return count;
  }

  function setDatasetVisible(datasetId, visible) {
    datasetVisibility.set(datasetId, visible);
    for (const group of tileGroups.values()) {
      if (group.userData.datasetId === datasetId) group.visible = visible;
    }
    return hasDatasetTiles(datasetId);
  }

  function setDatasetOpacity(datasetId, opacity) {
    const value = Math.min(1, Math.max(0, Number(opacity)));
    if (!Number.isFinite(value)) return;
    datasetOpacity.set(datasetId, value);
    applyOpacityToDataset(datasetId);
  }

  async function sync() {
    const { origin, distance, target, datasetIds } = getCameraState();
    const viewCenter = viewCenterFromTarget(origin, target);
    const gen = ++generation;
    activeAbortController?.abort();
    const abortController = new AbortController();
    activeAbortController = abortController;
    if (distance > MVT_MAX_CAMERA_DISTANCE || !datasetIds?.length) {
      evictOutside(new Set());
      return {
        mode: 'off',
        distance,
        count: 0,
        planned: 0,
        error: '',
        viewCenter
      };
    }

    lastError = '';
    let plans;
    try {
      const bounds = viewBounds(distance, viewCenter);
      plans = await planFetches(bounds, datasetIds);
    } catch (error) {
      lastError = error?.message ?? String(error);
      return { mode: 'error', distance, count: 0, planned: 0, error: lastError, viewCenter };
    }

    const limited = plans.slice(0, MAX_TILES);
    const styleById = Object.fromEntries(DATASETS.map(d => [d.id, styleForDataset(d.id)]));
    const keepKeys = new Set(limited.map(p => `${p.datasetId}:${p.z}/${p.x}/${p.y}:${p.cityCode}`));

    const queue = limited.filter(plan => {
      const key = `${plan.datasetId}:${plan.z}/${plan.x}/${plan.y}:${plan.cityCode}`;
      return !tileGroups.has(key);
    });
    let loadErrors = 0;
    let activeFetches = 0;

    await new Promise(resolve => {
      const pump = () => {
        if (gen !== generation || abortController.signal.aborted) return resolve();
        while (activeFetches < MAX_CONCURRENT && queue.length) {
          const plan = queue.shift();
          const key = `${plan.datasetId}:${plan.z}/${plan.x}/${plan.y}:${plan.cityCode}`;
          if (tileGroups.has(key)) continue;
          activeFetches += 1;
          fetchTile(plan, origin, styleById[plan.datasetId], abortController.signal)
            .then(group => {
              if (gen !== generation || abortController.signal.aborted) {
                disposeObject3D(group);
                return;
              }
              tileGroups.set(key, group);
              root.add(group);
            })
            .catch(error => {
              if (error?.name === 'AbortError') return;
              loadErrors += 1;
              lastError = error?.message ?? String(error);
              console.warn('MVT tile', plan.url, error);
            })
            .finally(() => {
              activeFetches -= 1;
              pump();
            });
        }
        if (activeFetches === 0 && queue.length === 0) resolve();
      };
      pump();
    });

    if (gen !== generation) {
      return {
        mode: 'on',
        distance,
        count: getVisibleTileCount(),
        planned: limited.length,
        error: '',
        viewCenter,
        stale: true
      };
    }

    evictOutside(keepKeys);

    if (!getVisibleTileCount() && limited.length && loadErrors) {
      return {
        mode: 'error',
        distance,
        count: 0,
        planned: limited.length,
        error: lastError || 'タイル取得に失敗しました',
        viewCenter
      };
    }

    return {
      mode: 'on',
      distance,
      count: getVisibleTileCount(),
      planned: limited.length,
      error: loadErrors ? `${loadErrors} タイル失敗: ${lastError}` : '',
      viewCenter
    };
  }

  function listLoadedTileKeys() {
    return [...tileGroups.keys()].sort();
  }

  return {
    sync,
    clearTiles,
    hasTiles,
    hasDatasetTiles,
    getVisibleTileCount,
    setDatasetVisible,
    setDatasetOpacity,
    listLoadedTileKeys,
    root
  };
}
