/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

export function createFeatureGroup(THREE, name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function createFeatureMesh(THREE, data, dataset) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  const isTransport = dataset === 'tran';
  const material = isTransport
    ? new THREE.MeshBasicMaterial({
      color: 0xc5cbc8, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    })
    : new THREE.MeshStandardMaterial({
      color: 0xc5cbc8, roughness: 0.92, metalness: 0, side: THREE.FrontSide
    });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData[isTransport ? 'transportMeshCode' : 'buildingMeshCode'] = data.code;
  if (isTransport) mesh.renderOrder = 3;
  return mesh;
}

export function disposeFeatureMesh(mesh) {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose());
  else mesh.material.dispose();
}

export function reconcileFeatureEntries(group, currentEntries, nextEntries) {
  for (const [code, entry] of currentEntries) {
    if (nextEntries.get(code) === entry) continue;
    group.remove(entry.mesh);
    disposeFeatureMesh(entry.mesh);
  }
  for (const [code, entry] of nextEntries) {
    if (currentEntries.get(code) !== entry) group.add(entry.mesh);
  }
}

export function summarizeFeatureEntries(entries) {
  return [...entries.values()].reduce((summary, entry) => {
    summary.features += entry.data.featureCount ?? 0;
    summary.faces += entry.data.faceCount ?? 0;
    summary.skippedFaces += entry.data.skippedFaceCount ?? 0;
    return summary;
  }, { features: 0, faces: 0, skippedFaces: 0 });
}

export function retainFeatureEntries(entries, codes, compatible) {
  if (!compatible) return new Map();
  const targets = new Set(codes);
  return new Map([...entries].filter(([code]) => targets.has(code)));
}

export function mergeFeatureEntries(codes, retained, staged) {
  const entries = new Map();
  for (const code of codes) {
    const entry = retained.get(code) ?? staged.get(code);
    if (entry) entries.set(code, entry);
  }
  return entries;
}

export function clearFeatureEntries(group, entries) {
  for (const entry of entries.values()) disposeFeatureMesh(entry.mesh);
  entries.clear();
  group.clear();
}

export function stageFeatureEntries(THREE, loadedData, dataset) {
  const entries = new Map();
  for (const data of loadedData) {
    if (!data || data.indices.length === 0) continue;
    entries.set(data.code, { data, mesh: createFeatureMesh(THREE, data, dataset) });
  }
  return entries;
}

export function createFeatureLayerController(THREE, options) {
  let entries = new Map();
  let frameKey = null;
  let projectionKey = null;
  let sequence = 0;
  let abortController = null;

  function clear(message) {
    abortController?.abort();
    abortController = null;
    sequence += 1;
    clearFeatureEntries(options.group, entries);
    frameKey = null;
    projectionKey = null;
    options.onStatus(message, false);
  }

  async function request(context) {
    const { latitude, longitude, detailLevel, origin, zone } = context;
    if (!options.isVisible()) {
      clear(options.hiddenMessage);
      return;
    }
    if (detailLevel < options.minLod) {
      clear(options.lodMessage(detailLevel));
      return;
    }
    const codes = options.codesAround(latitude, longitude);
    const nextProjectionKey = `${zone}|${origin.latitude}|${origin.longitude}|${origin.altitude ?? 0}`;
    const nextFrameKey = `${codes.join(',')}|${nextProjectionKey}`;
    if (nextFrameKey === frameKey) return;
    const requestSequence = ++sequence;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    const retained = retainFeatureEntries(entries, codes, projectionKey === nextProjectionKey);
    const additions = codes.filter(code => !retained.has(code));
    options.onStatus(options.loadingMessage(detailLevel, additions.length), false);
    try {
      const staged = new Map();
      const commit = () => {
        const nextEntries = mergeFeatureEntries(codes, retained, staged);
        reconcileFeatureEntries(options.group, entries, nextEntries);
        entries = nextEntries;
      };
      if (additions.length === 0) commit();
      const loadOne = async code => {
        try {
          const data = await options.loader.load(code, {
            origin,
            zone,
            signal: controller.signal,
            priority: options.loadPriority?.(code, codes)
          });
          if (controller.signal.aborted || requestSequence !== sequence) return;
          const loadedEntry = stageFeatureEntries(THREE, data ? [data] : [], options.dataset).get(code);
          if (loadedEntry) staged.set(code, loadedEntry);
          commit();
          options.onProgress?.({ detailLevel, loaded: staged.size, total: additions.length, code });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          console.warn(error);
        }
      };
      if (additions.length > 0) {
        await loadOne(additions[0]);
        await Promise.all(additions.slice(1).map(loadOne));
      }
      if (controller.signal.aborted || requestSequence !== sequence) return;
      frameKey = nextFrameKey;
      projectionKey = nextProjectionKey;
      options.onStatus(options.successMessage({
        detailLevel,
        fileCount: entries.size,
        requestedCount: codes.length,
        summary: summarizeFeatureEntries(entries),
        cache: options.loader.getCacheStatus()
      }), false);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
        options.onStatus(options.errorMessage, true);
      }
    }
  }

  return { clear, request, getEntries: () => entries };
}
