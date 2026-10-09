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

import { buildContourSegments } from '../domain/contours.js';

export function terrainTileKey(tile) {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function hasCompatibleTerrainLayout(current, next, resetFocus) {
  if (!current.group || !current.setting || !current.origin || resetFocus) return false;
  return current.setting.tileZoom === next.setting.tileZoom
    && current.setting.elevationZoom === next.setting.elevationZoom
    && current.setting.fallbackElevationZoom === next.setting.fallbackElevationZoom
    && current.setting.imageZoom === next.setting.imageZoom
    && current.setting.gridSize === next.setting.gridSize
    && current.zone === next.zone
    && current.textureType === next.textureType
    && current.origin.latitude === next.origin.latitude
    && current.origin.longitude === next.origin.longitude
    && (current.origin.altitude ?? 0) === (next.origin.altitude ?? 0);
}

export function planTerrainTransition(options) {
  const {
    centerTile, tiles, setting, origin, zone, textureType, automatic, resetFocus,
    currentGroup, currentEntries, currentSetting, currentOrigin, currentZone, currentTextureType
  } = options;
  const reusable = automatic && hasCompatibleTerrainLayout(
    { group: currentGroup, setting: currentSetting, origin: currentOrigin, zone: currentZone, textureType: currentTextureType },
    { setting, origin, zone, textureType },
    resetFocus
  );
  const retainedEntries = new Map();
  if (reusable) {
    for (const tile of tiles) {
      const key = terrainTileKey(tile);
      const entry = currentEntries.get(key);
      if (entry) retainedEntries.set(key, entry);
    }
  }
  return {
    centerTile,
    tiles,
    reusable,
    retainedEntries,
    tilesToBuild: tiles.filter(tile => !retainedEntries.has(terrainTileKey(tile))),
    removedTileCount: reusable
      ? Math.max(0, currentEntries.size - retainedEntries.size)
      : currentEntries.size
  };
}

export function disposeTerrainEntries(entries) {
  entries.forEach(entry => disposeTerrainMesh(entry.mesh));
}

export function createTerrainMesh(THREE, data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();

  const texture = new THREE.Texture(data.texture.bitmap);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
    side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.terrainTileKey = terrainTileKey(data.tile);
  return mesh;
}

export function stageTerrainEntries(THREE, dataList) {
  return new Map(dataList.map(data => [terrainTileKey(data.tile), { data, mesh: createTerrainMesh(THREE, data) }]));
}

export function orderedTerrainData(tiles, retainedEntries, stagedEntries) {
  return tiles.map(tile => retainedEntries.get(terrainTileKey(tile))?.data
    ?? stagedEntries.get(terrainTileKey(tile))?.data).filter(Boolean);
}

export function createTerrainGroup(THREE, tiles, retainedEntries, stagedEntries) {
  const group = new THREE.Group();
  const entries = new Map();
  for (const tile of tiles) {
    const key = terrainTileKey(tile);
    const entry = retainedEntries.get(key) ?? stagedEntries.get(key);
    if (!entry) continue;
    entries.set(key, entry);
    group.add(entry.mesh);
  }
  return { group, entries };
}

export function disposeTerrainMesh(mesh) {
  if (!mesh) return;
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.map?.image?.close?.();
    material.map?.dispose();
    material.dispose();
  }
}

export function disposeTerrainGroup(group) {
  if (!group) return;
  group.traverse(object => {
    if (object.isMesh) disposeTerrainMesh(object);
  });
}

export function disposeContourLayer(scene, group) {
  if (!group) return;
  scene.remove(group);
  group.traverse(object => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });
}

export function createContourLayer(THREE, document, terrainData, options) {
  const { interval, detailLevel, majorEvery, minorColor, majorColor, offsetBaseLod, offsetMin, offsetMax, contourSetting } = options;
  const group = new THREE.Group();
  const segments = [];
  const surfaceOffset = THREE.MathUtils.clamp(2 ** ((offsetBaseLod - detailLevel) / 2), offsetMin, offsetMax);
  const minorPositions = [], majorPositions = [], majorLabelPoints = [];
  for (const terrain of terrainData) {
    const terrainSegments = buildContourSegments(terrain, interval);
    segments.push(...terrainSegments);
    const labeledHeights = new Set();
    for (const segment of terrainSegments) {
      const isMajor = Math.abs(Math.round(segment.height / interval)) % majorEvery === 0;
      (isMajor ? majorPositions : minorPositions).push(
        segment.start.x, segment.start.y + surfaceOffset, segment.start.z,
        segment.end.x, segment.end.y + surfaceOffset, segment.end.z
      );
      if (isMajor && !labeledHeights.has(segment.height)) {
        labeledHeights.add(segment.height);
        majorLabelPoints.push({
          x: (segment.start.x + segment.end.x) / 2,
          y: segment.height + surfaceOffset,
          z: (segment.start.z + segment.end.z) / 2,
          height: segment.height
        });
      }
    }
  }
  const addLines = (positions, color, renderOrder) => {
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = renderOrder;
    group.add(lines);
  };
  addLines(minorPositions, minorColor, 4);
  addLines(majorPositions, majorColor, 5);
  const labelMaterials = new Map();
  for (const point of majorLabelPoints) {
    const label = `${Number(point.height).toFixed(1)} m`;
    let material = labelMaterials.get(label);
    if (!material) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const context = canvas.getContext('2d');
      context.font = '700 30px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.lineWidth = 7; context.strokeStyle = 'rgba(255,255,255,.95)'; context.strokeText(label, 128, 32);
      context.fillStyle = '#000000'; context.fillText(label, 128, 32);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false;
      material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      labelMaterials.set(label, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.position.set(point.x, point.y + contourSetting.labelHeight * 0.25, point.z);
    sprite.userData.contourLabelPixels = contourSetting.displayLabelPixels;
    sprite.renderOrder = 6;
    group.add(sprite);
  }
  return { group, segments, surfaceOffset };
}
