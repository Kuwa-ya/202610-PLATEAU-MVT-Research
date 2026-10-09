import { DATASETS, MVT_MAX_CAMERA_DISTANCE } from './mvt-config.js';
import { decodeMvt } from './mvt-decode.js';
import { viewCenterFromTarget } from './local-frame.js';
import { planFetches } from './mvt-index.js';
import { buildTileGroup, disposeObject3D } from './mvt-mesh.js';

const MAX_CONCURRENT = 4;
const MAX_TILES = 32;

export function createMvtController(THREE, scene, getCameraState) {
  const root = new THREE.Group();
  root.name = 'plateau-mvt-root';
  scene.add(root);
  const tileGroups = new Map();
  let inflight = 0;
  let generation = 0;
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

  async function fetchTile(plan, origin, datasetStyle) {
    const response = await fetch(plan.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const { features, extent } = await decodeMvt(buffer, plan.sourceLayer);
    if (!features.length) throw new Error('地物 0 件');
    const group = buildTileGroup(
      THREE, features, plan.x, plan.y, plan.z, origin, datasetStyle, extent
    );
    group.userData.featureCount = features.length;
    let drawable = 0;
    group.traverse(node => {
      if (node.isMesh || node.isLine) drawable += 1;
    });
    if (!drawable) throw new Error('描画可能な地物 0 件（ジオメトリ変換を確認）');
    return group;
  }

  function clearTiles() {
    for (const group of tileGroups.values()) {
      root.remove(group);
      disposeObject3D(group);
    }
    tileGroups.clear();
  }

  async function sync() {
    const { origin, distance, target, datasetIds } = getCameraState();
    const viewCenter = viewCenterFromTarget(origin, target);
    if (distance > MVT_MAX_CAMERA_DISTANCE || !datasetIds?.length) {
      clearTiles();
      return {
        mode: 'off',
        distance,
        count: 0,
        planned: 0,
        error: '',
        viewCenter
      };
    }

    const gen = ++generation;
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
    const styleById = Object.fromEntries(DATASETS.map(d => [d.id, d]));
    const keepKeys = new Set(limited.map(p => `${p.datasetId}:${p.z}/${p.x}/${p.y}`));
    for (const [key, group] of tileGroups) {
      if (!keepKeys.has(key)) {
        root.remove(group);
        disposeObject3D(group);
        tileGroups.delete(key);
      }
    }

    const queue = [...limited];
    let loadErrors = 0;

    await new Promise(resolve => {
      const pump = () => {
        if (gen !== generation) return resolve();
        while (inflight < MAX_CONCURRENT && queue.length) {
          const plan = queue.shift();
          const key = `${plan.datasetId}:${plan.z}/${plan.x}/${plan.y}`;
          if (tileGroups.has(key)) continue;
          inflight += 1;
          fetchTile(plan, origin, styleById[plan.datasetId])
            .then(group => {
              if (gen !== generation) {
                disposeObject3D(group);
                return;
              }
              tileGroups.set(key, group);
              root.add(group);
            })
            .catch(error => {
              loadErrors += 1;
              lastError = error?.message ?? String(error);
              console.warn('MVT tile', plan.url, error);
            })
            .finally(() => {
              inflight -= 1;
              pump();
            });
        }
        if (inflight === 0 && queue.length === 0) resolve();
      };
      pump();
    });

    if (!tileGroups.size && limited.length && loadErrors) {
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
      count: tileGroups.size,
      planned: limited.length,
      error: loadErrors ? `${loadErrors} タイル失敗: ${lastError}` : '',
      viewCenter
    };
  }

  return { sync, clearTiles, root };
}
