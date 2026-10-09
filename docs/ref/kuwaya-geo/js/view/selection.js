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

import { latLonToTile, tileBounds } from '../geometric/web-mesh-code.js';
import { localPositionToLatLon, toLocalPosition } from '../foundation/local-frame.js';
import { meshBounds, meshCodeFromLatLon, snapBoundsToRegionalMeshes } from '../domain/features.js';
import { thirdMeshCodesForBounds } from '../geometric/japan-mesh-code.js';

export function boundsFromPoints(first, second) {
  return {
    north: Math.max(first.latitude, second.latitude),
    south: Math.min(first.latitude, second.latitude),
    east: Math.max(first.longitude, second.longitude),
    west: Math.min(first.longitude, second.longitude)
  };
}

export function createSelectionState() {
  return {
    mode: false,
    points: [],
    previewPoint: null,
    bounds() {
      return this.points.length < 2 ? null : boundsFromPoints(this.points[0], this.points[1]);
    },
    clear() {
      this.mode = false;
      this.points = [];
      this.previewPoint = null;
    },
    toggle() {
      this.mode = !this.mode;
      if (this.mode) {
        this.points = [];
        this.previewPoint = null;
      }
      return this.mode;
    },
    addPoint(point) {
      this.points.push(point);
      this.previewPoint = null;
      if (this.points.length < 2) return false;
      this.points = this.points.slice(-2);
      this.mode = false;
      return true;
    },
    setPreview(point) {
      this.previewPoint = point;
    }
  };
}

export function tilesForBounds(bounds, zoom) {
  const northWest = latLonToTile(bounds.north, bounds.west, zoom);
  const southEast = latLonToTile(bounds.south + 1e-12, bounds.east - 1e-12, zoom);
  const tiles = [];
  for (let y = northWest.y; y <= southEast.y; y += 1) {
    for (let x = northWest.x; x <= southEast.x; x += 1) tiles.push({ z: zoom, x, y });
  }
  return tiles;
}

export function displayedTerrainBounds(terrainData) {
  if (terrainData.length === 0) return null;
  const bounds = terrainData.map(data => tileBounds(data.tile.x, data.tile.y, data.tile.z));
  return {
    north: Math.max(...bounds.map(value => value.north)),
    south: Math.min(...bounds.map(value => value.south)),
    east: Math.max(...bounds.map(value => value.east)),
    west: Math.min(...bounds.map(value => value.west))
  };
}

export function snapBoundsToTiles(bounds, zoom) {
  const tiles = tilesForBounds(bounds, zoom);
  const minX = Math.min(...tiles.map(tile => tile.x));
  const maxX = Math.max(...tiles.map(tile => tile.x));
  const minY = Math.min(...tiles.map(tile => tile.y));
  const maxY = Math.max(...tiles.map(tile => tile.y));
  const northWest = tileBounds(minX, minY, zoom);
  const southEast = tileBounds(maxX, maxY, zoom);
  return {
    north: northWest.north,
    south: southEast.south,
    east: southEast.east,
    west: northWest.west
  };
}

export function pickTerrainPoint({ event, canvas, camera, terrain, origin, zone, raycaster, pointer }) {
  if (!terrain || !origin) return null;
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    (event.clientX - rect.left) / rect.width * 2 - 1,
    -((event.clientY - rect.top) / rect.height * 2 - 1)
  );
  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.intersectObject(terrain, true)[0];
  if (!intersection) return null;
  return localPositionToLatLon(intersection.point.x, intersection.point.z, origin, zone);
}

export function disposePreviewGroup(scene, group) {
  if (!group) return;
  scene.remove(group);
  group.traverse(object => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
    else object.material?.dispose();
  });
}

export function createPreviewLabel(THREE, document, { text, color, position, displayPixels }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(5, 10, 8, .38)';
  context.fillRect(4, 4, 504, 120);
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.strokeRect(4, 4, 504, 120);
  context.font = '700 48px Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(100, 25, 1);
  sprite.userData.previewLabelPixels = displayPixels;
  sprite.userData.labelAspect = 4;
  sprite.renderOrder = 24;
  return sprite;
}

export function createPreviewLines(THREE, positions, options = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: options.color,
    depthTest: false,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = options.renderOrder ?? 20;
  return lines;
}

export function createPreviewWireframe(THREE, positions, indices, options = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const material = new THREE.MeshBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity ?? 0.72,
    wireframe: true,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = options.renderOrder ?? 20;
  return mesh;
}

export function createExportPreviewGroup(THREE, document, prepared, type, segments, options) {
  const group = new THREE.Group();
  const addLabel = (text, color, position) => group.add(createPreviewLabel(THREE, document, {
    text, color, position, displayPixels: options.displayLabelPixels
  }));
  if (type.startsWith('building-') || type.startsWith('transport-')) {
    const color = 0x45dbea;
    const positions = [];
    for (const code of prepared.requestedCodes ?? prepared.data.map(feature => feature.code)) {
      const bounds = meshBounds(code);
      const corners = [[bounds.south, bounds.west], [bounds.south, bounds.east],
        [bounds.north, bounds.east], [bounds.north, bounds.west]]
        .map(([latitude, longitude]) => toLocalPosition(latitude, longitude, 0, prepared.origin, prepared.zone, 1));
      for (let index = 0; index < corners.length; index += 1) {
        const start = corners[index], end = corners[(index + 1) % corners.length];
        positions.push(start.x, 5, start.z, end.x, 5, end.z);
      }
      addLabel(code, '#45dbea', new THREE.Vector3(
        (corners[0].x + corners[2].x) / 2, 12, (corners[0].z + corners[2].z) / 2
      ));
    }
    group.add(createPreviewLines(THREE, positions, { color, renderOrder: 21 }));
    if (type.endsWith('-glb')) {
      for (const feature of prepared.data) group.add(createPreviewWireframe(THREE, feature.positions, feature.indices, {
        color, opacity: 0.72, renderOrder: 22
      }));
    } else {
      const outlines = [];
      for (const segment of segments) outlines.push(segment.start.x, 5, segment.start.z, segment.end.x, 5, segment.end.z);
      group.add(createPreviewLines(THREE, outlines, { color, renderOrder: 22 }));
    }
  } else if (type === 'citygml-dem') {
    const color = 0xff7a29;
    const outlines = [];
    for (const [code, grids] of prepared.meshGridsByCode) {
      const bounds = grids[0]?.outputBounds;
      if (!bounds) continue;
      const corners = [[bounds.south, bounds.west], [bounds.south, bounds.east],
        [bounds.north, bounds.east], [bounds.north, bounds.west]]
        .map(([latitude, longitude]) => toLocalPosition(latitude, longitude, 0, prepared.origin, prepared.zone, 1));
      for (let index = 0; index < corners.length; index += 1) {
        const start = corners[index], end = corners[(index + 1) % corners.length];
        outlines.push(start.x, 8, start.z, end.x, 8, end.z);
      }
      addLabel(code, '#ff7a29', new THREE.Vector3(
        (corners[0].x + corners[2].x) / 2, 14, (corners[0].z + corners[2].z) / 2
      ));
    }
    group.add(createPreviewLines(THREE, outlines, { color }));
    for (const grids of prepared.meshGridsByCode.values()) for (const grid of grids) {
      const positions = new Float32Array(grid.vertexCount * 3);
      for (let index = 0; index < grid.vertexCount; index += 1) {
        const local = toLocalPosition(grid.latitudes[index], grid.longitudes[index], grid.elevations[index], prepared.origin, prepared.zone, 1);
        positions.set([local.x, local.y, local.z], index * 3);
      }
      group.add(createPreviewWireframe(THREE, positions, grid.indices, { color, opacity: 0.55, renderOrder: 22 }));
    }
  } else if (type === 'glb') {
    for (const terrain of prepared.data) group.add(createPreviewWireframe(THREE, terrain.positions, terrain.indices, {
      color: 0xf2cf3a, opacity: 0.72, renderOrder: 20
    }));
  } else {
    const positions = [];
    for (const segment of segments) positions.push(
      segment.start.x, segment.start.y, segment.start.z, segment.end.x, segment.end.y, segment.end.z
    );
    group.add(createPreviewLines(THREE, positions, { color: 0xf2cf3a, renderOrder: 20 }));
  }
  if (!type.startsWith('building-') && !type.startsWith('transport-') && type !== 'citygml-dem') {
    for (const terrain of prepared.data) {
      const bounds = tileBounds(terrain.tile.x, terrain.tile.y, terrain.tile.z);
      const center = toLocalPosition((bounds.north + bounds.south) / 2, (bounds.west + bounds.east) / 2, 0, prepared.origin, prepared.zone, 1);
      addLabel(`${terrain.tile.z}/${terrain.tile.x}/${terrain.tile.y}`, '#f2cf3a', new THREE.Vector3(center.x, 12, center.z));
    }
  }
  if (options.currentOrigin) {
    const offset = toLocalPosition(prepared.origin.latitude, prepared.origin.longitude, prepared.origin.altitude ?? 0,
      options.currentOrigin, options.currentZone, 1);
    group.position.set(offset.x, offset.y, offset.z);
  }
  return group;
}

export function disposeSelectionOutline(scene, outline) {
  if (!outline) return;
  scene.remove(outline);
  outline.traverse(object => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
}

export function createSelectionOutline(THREE, rawBounds, options) {
  const { setting, origin, zone, elevation, maxExportTiles, maxRegionalMeshes } = options;
  const tiles = tilesForBounds(rawBounds, setting.tileZoom);
  const exceedsExportLimit = tiles.length > maxExportTiles;
  const { bounds: regionalBounds, codes } = snapBoundsToRegionalMeshes(rawBounds, maxRegionalMeshes + 1);
  const exceedsRegionalLimit = codes.length > maxRegionalMeshes;
  const minX = Math.min(...tiles.map(tile => tile.x)), maxX = Math.max(...tiles.map(tile => tile.x));
  const minY = Math.min(...tiles.map(tile => tile.y)), maxY = Math.max(...tiles.map(tile => tile.y));
  const tileBoundsSnapped = snapBoundsToTiles(rawBounds, setting.tileZoom);
  const localVector = (latitude, longitude, offset) => {
    const point = toLocalPosition(latitude, longitude, 0, origin, zone, 1);
    return new THREE.Vector3(point.x, elevation + offset, point.z);
  };
  const tileLines = [];
  for (let x = minX; x <= maxX + 1; x += 1) {
    const longitude = tileBounds(x, minY, setting.tileZoom).west;
    tileLines.push(localVector(tileBoundsSnapped.north, longitude, 6), localVector(tileBoundsSnapped.south, longitude, 6));
  }
  for (let y = minY; y <= maxY + 1; y += 1) {
    const latitude = tileBounds(minX, y, setting.tileZoom).north;
    tileLines.push(localVector(latitude, tileBoundsSnapped.west, 6), localVector(latitude, tileBoundsSnapped.east, 6));
  }
  const group = new THREE.Group();
  const addGrid = (points, color, renderOrder) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
    lines.renderOrder = renderOrder;
    group.add(lines);
  };
  addGrid(tileLines, exceedsExportLimit ? 0xff5f52 : 0xf2cf3a, 10);
  const regionalLines = [];
  if (regionalBounds) {
    const anchor = meshBounds(meshCodeFromLatLon(regionalBounds.south + 1e-12, regionalBounds.west + 1e-12));
    const latSteps = Math.round((regionalBounds.north - regionalBounds.south) / anchor.height);
    const lonSteps = Math.round((regionalBounds.east - regionalBounds.west) / anchor.width);
    for (let index = 0; index <= lonSteps; index += 1) {
      const longitude = regionalBounds.west + index * anchor.width;
      regionalLines.push(localVector(regionalBounds.north, longitude, 8), localVector(regionalBounds.south, longitude, 8));
    }
    for (let index = 0; index <= latSteps; index += 1) {
      const latitude = regionalBounds.south + index * anchor.height;
      regionalLines.push(localVector(latitude, regionalBounds.west, 8), localVector(latitude, regionalBounds.east, 8));
    }
  }
  addGrid(regionalLines, exceedsRegionalLimit ? 0xff5f52 : 0x45dbea, 11);
  const corners = [[rawBounds.south, rawBounds.west], [rawBounds.south, rawBounds.east],
    [rawBounds.north, rawBounds.east], [rawBounds.north, rawBounds.west]]
    .map(([latitude, longitude]) => localVector(latitude, longitude, 10));
  const rawLines = [];
  for (let index = 0; index < corners.length; index += 1) rawLines.push(corners[index], corners[(index + 1) % corners.length]);
  addGrid(rawLines, 0xffffff, 12);
  return group;
}

export function describeSelection(bounds, options) {
  if (!bounds) return null;
  const { setting, maxExportTiles, maxRegionalMeshes, cityGmlLod, cityGmlLimits, displayLevels } = options;
  const tileCount = tilesForBounds(bounds, setting.tileZoom).length;
  const regionalCount = snapBoundsToRegionalMeshes(bounds, maxRegionalMeshes + 1).codes.length;
  const cityLimit = cityGmlLimits[cityGmlLod] ?? cityGmlLimits[1];
  const cityCount = thirdMeshCodesForBounds(bounds, cityLimit + 1).length;
  const snapped = snapBoundsToTiles(bounds, setting.tileZoom);
  const tooManyTiles = tileCount > maxExportTiles;
  const tooManyRegional = regionalCount > maxRegionalMeshes;
  const tooManyCity = cityCount > cityLimit;
  const error = tooManyTiles || tooManyRegional || tooManyCity;
  if (!error) return {
    error,
    text: `地形 LOD ${setting.detailLevel} ${tileCount}/${maxExportTiles}タイル／建物・道路 ${regionalCount}/${maxRegionalMeshes}地域メッシュ／CityGML ${cityCount}/${cityLimit}三次メッシュ／${snapped.south.toFixed(6)}, ${snapped.west.toFixed(6)} ～ ${snapped.north.toFixed(6)}, ${snapped.east.toFixed(6)}`
  };
  const highestAvailable = displayLevels.filter(candidate =>
    tilesForBounds(bounds, candidate.tileZoom).length <= maxExportTiles
  ).at(-1);
  const hints = [
    tooManyTiles ? (highestAvailable ? `LOD ${highestAvailable.detailLevel}以下へ変更してください。` : '地形範囲を狭くしてください。') : '',
    tooManyRegional ? '建物・道路範囲を狭くしてください。' : '',
    tooManyCity ? `CityGML LOD${cityGmlLod}は${cityLimit}三次メッシュ以内にしてください。` : ''
  ].join('');
  return {
    error,
    text: `一部出力制限：地形 LOD ${setting.detailLevel} ${tileCount}/${maxExportTiles}タイル／建物・道路 ${tooManyRegional ? `${maxRegionalMeshes}超` : regionalCount}/${maxRegionalMeshes}地域メッシュ／CityGML ${tooManyCity ? `${cityLimit}超` : cityCount}/${cityLimit}三次メッシュ。${hints}`
  };
}
