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

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TEXTURE_EDGE_PADDING = 4;
const encoder = new TextEncoder();

function align4(value) { return (value + 3) & ~3; }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob.size;
}

function minMaxVec3(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }
  return { min, max };
}

function calculateNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const abx = positions[ib] - positions[ia];
    const aby = positions[ib + 1] - positions[ia + 1];
    const abz = positions[ib + 2] - positions[ia + 2];
    const acx = positions[ic] - positions[ia];
    const acy = positions[ic + 1] - positions[ia + 1];
    const acz = positions[ic + 2] - positions[ia + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const offset of [ia, ib, ic]) {
      normals[offset] += nx;
      normals[offset + 1] += ny;
      normals[offset + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }
  return normals;
}

async function canvasToPngBytes(canvas) {
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('GLB用テクスチャをPNGへ変換できませんでした。')),
      'image/png'
    ));
  return new Uint8Array(await blob.arrayBuffer());
}

async function addTextureEdgePadding(texture, uvs, padding = TEXTURE_EDGE_PADDING) {
  const sourceBlob = new Blob([texture.bytes], { type: texture.mimeType });
  const bitmap = await createImageBitmap(sourceBlob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const outputWidth = width + padding * 2;
    const outputHeight = height + padding * 2;
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(outputWidth, outputHeight)
      : Object.assign(document.createElement('canvas'), { width: outputWidth, height: outputHeight });
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, padding, padding, width, height);
    context.drawImage(bitmap, 0, 0, width, 1, padding, 0, width, padding);
    context.drawImage(bitmap, 0, height - 1, width, 1, padding, padding + height, width, padding);
    context.drawImage(bitmap, 0, 0, 1, height, 0, padding, padding, height);
    context.drawImage(bitmap, width - 1, 0, 1, height, padding + width, padding, padding, height);
    context.drawImage(bitmap, 0, 0, 1, 1, 0, 0, padding, padding);
    context.drawImage(bitmap, width - 1, 0, 1, 1, padding + width, 0, padding, padding);
    context.drawImage(bitmap, 0, height - 1, 1, 1, 0, padding + height, padding, padding);
    context.drawImage(bitmap, width - 1, height - 1, 1, 1, padding + width, padding + height, padding, padding);
    const paddedUvs = new Float32Array(uvs.length);
    const uScale = width / outputWidth;
    const vScale = height / outputHeight;
    const uOffset = padding / outputWidth;
    const vOffset = padding / outputHeight;
    for (let index = 0; index < uvs.length; index += 2) {
      paddedUvs[index] = uOffset + uvs[index] * uScale;
      paddedUvs[index + 1] = vOffset + uvs[index + 1] * vScale;
    }
    return { bytes: await canvasToPngBytes(canvas), mimeType: 'image/png', uvs: paddedUvs, padding };
  } finally {
    bitmap.close?.();
  }
}

function nodeExtras(terrain, unit, texturePadding) {
  return {
    demTile: terrain.tile,
    elevationSourceZoom: terrain.elevationSourceZoom,
    fallbackElevationSourceZoom: terrain.fallbackElevationSourceZoom,
    elevationSources: terrain.elevationSourceIds,
    elevationState: terrain.elevationState ?? (terrain.elevationMissing ? 'zeroFallback' : 'measured'),
    elevationFallbackReason: terrain.elevationFallbackReason ?? null,
    elevationTerminalZoom: terrain.elevationTerminalZoom ?? null,
    elevationFailures: terrain.elevationFailures ?? [],
    textureTiles: terrain.texture.tiles.map(({ z, x, y }) => ({ z, x, y })),
    textureSource: terrain.texture.sourceId,
    textureSourceUrls: terrain.texture.urls,
    geographicCrs: 'EPSG:6668',
    jprcZone: terrain.zone,
    originLatitude: terrain.origin.latitude,
    originLongitude: terrain.origin.longitude,
    originAltitude: terrain.origin.altitude,
    coordinateSystem: 'JPRC_LOCAL_Y_UP',
    axisMapping: 'X=EAST,Y=UP,Z=SOUTH',
    unit,
    heightScale: terrain.heightScale,
    textureEdgePaddingPixels: texturePadding
  };
}

export async function createGlb(terrainInput, options = {}) {
  const terrains = Array.isArray(terrainInput) ? terrainInput : [terrainInput];
  if (terrains.length === 0) throw new Error('GLBへ出力する地形がありません。');
  const unit = options.unit ?? 'mm';
  const unitScale = { m: 1, cm: 100, mm: 1000 }[unit];
  if (!unitScale) throw new RangeError(`未対応の出力単位です: ${unit}`);

  const records = await Promise.all(terrains.map(async terrain => {
    const positions = unitScale === 1
      ? terrain.positions
      : Float32Array.from(terrain.positions, value => value * unitScale);
    const paddedTexture = await addTextureEdgePadding(terrain.texture, terrain.uvs);
    return { terrain, positions, normals: calculateNormals(positions, terrain.indices), paddedTexture };
  }));
  const segments = [];
  let binaryLength = 0;
  for (const record of records) {
    const arrays = [record.positions, record.normals, record.paddedTexture.uvs, record.terrain.indices, record.paddedTexture.bytes];
    record.segmentStart = segments.length;
    for (const source of arrays) {
      binaryLength = align4(binaryLength);
      segments.push({ byteOffset: binaryLength, byteLength: source.byteLength, source });
      binaryLength += source.byteLength;
    }
  }
  binaryLength = align4(binaryLength);

  const binary = new Uint8Array(binaryLength);
  for (const segment of segments) {
    binary.set(new Uint8Array(segment.source.buffer, segment.source.byteOffset, segment.source.byteLength), segment.byteOffset);
  }

  const bufferViews = segments.map((segment, index) => {
    const kind = index % 5;
    const view = { buffer: 0, byteOffset: segment.byteOffset, byteLength: segment.byteLength };
    if (kind <= 2) view.target = 34962;
    if (kind === 3) view.target = 34963;
    return view;
  });
  const accessors = [];
  const nodes = [];
  const meshes = [];
  const materials = [];
  const textures = [];
  const images = [];

  records.forEach((record, index) => {
    const { terrain, positions, normals, segmentStart } = record;
    const accessorStart = accessors.length;
    const bounds = minMaxVec3(positions);
    const tileLabel = `${terrain.tile.z}/${terrain.tile.x}/${terrain.tile.y}`;
    accessors.push(
      { bufferView: segmentStart, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: bounds.min, max: bounds.max },
      { bufferView: segmentStart + 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: segmentStart + 2, componentType: 5126, count: record.paddedTexture.uvs.length / 2, type: 'VEC2' },
      { bufferView: segmentStart + 3, componentType: 5125, count: terrain.indices.length, type: 'SCALAR' }
    );
    const node = { mesh: index, name: `DEM ${tileLabel}`, extras: nodeExtras(terrain, unit, record.paddedTexture.padding) };
    // glTF defines metres as its physical unit. Accessor values may be written
    // in the selected unit, while this node scale preserves the real size.
    if (unitScale !== 1) node.scale = [1 / unitScale, 1 / unitScale, 1 / unitScale];
    nodes.push(node);
    meshes.push({ primitives: [{
      attributes: { POSITION: accessorStart, NORMAL: accessorStart + 1, TEXCOORD_0: accessorStart + 2 },
      indices: accessorStart + 3,
      material: index,
      mode: 4
    }] });
    materials.push({
      name: `${terrain.texture.sourceId}_${tileLabel.replaceAll('/', '_')}_material`,
      pbrMetallicRoughness: { baseColorTexture: { index }, metallicFactor: 0, roughnessFactor: 1 },
      doubleSided: false
    });
    textures.push({ source: index, sampler: 0 });
    images.push({
      bufferView: segmentStart + 4,
      mimeType: record.paddedTexture.mimeType,
      name: `${terrain.texture.sourceId}_${tileLabel.replaceAll('/', '_')}`
    });
  });

  const json = {
    asset: { version: '2.0', generator: 'ちずうつし v1.1.0 / Kuwa-ya, Ltd.', extras: { productName: 'ちずうつし', creator: 'Kuwa-ya, Ltd.', applicationVersion: 'v1.1.0', attribution: '国土地理院 地理院タイル', unit } },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials,
    textures,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images,
    buffers: [{ byteLength: binaryLength }],
    bufferViews,
    accessors
  };

  const jsonBytes = encoder.encode(JSON.stringify(json));
  const paddedJsonLength = align4(jsonBytes.length);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + binaryLength;
  const output = new ArrayBuffer(totalLength);
  const view = new DataView(output);
  const bytes = new Uint8Array(output);
  let offset = 0;

  view.setUint32(offset, GLB_MAGIC, true); offset += 4;
  view.setUint32(offset, 2, true); offset += 4;
  view.setUint32(offset, totalLength, true); offset += 4;
  view.setUint32(offset, paddedJsonLength, true); offset += 4;
  view.setUint32(offset, JSON_CHUNK, true); offset += 4;
  bytes.fill(0x20, offset, offset + paddedJsonLength);
  bytes.set(jsonBytes, offset); offset += paddedJsonLength;
  view.setUint32(offset, binaryLength, true); offset += 4;
  view.setUint32(offset, BIN_CHUNK, true); offset += 4;
  bytes.set(binary, offset);
  return output;
}

export async function downloadGlb(terrainInput, options = {}) {
  const terrains = Array.isArray(terrainInput) ? terrainInput : [terrainInput];
  const unit = options.unit ?? 'mm';
  const data = await createGlb(terrains, { unit });
  const blob = new Blob([data], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const tiles = terrains.map(terrain => terrain.tile);
  const first = tiles[0];
  const minX = Math.min(...tiles.map(tile => tile.x));
  const maxX = Math.max(...tiles.map(tile => tile.x));
  const minY = Math.min(...tiles.map(tile => tile.y));
  const maxY = Math.max(...tiles.map(tile => tile.y));
  const link = document.createElement('a');
  link.href = url;
  link.download = terrains.length === 1
    ? `dem_z${first.z}_${first.x}_${first.y}_${unit}.glb`
    : `dem_z${first.z}_${terrains.length}tiles_x${minX}-${maxX}_y${minY}-${maxY}_${unit}.glb`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}

export function createBuildingGlb(buildings, options = {}) {
  if (buildings.length === 0) throw new Error('GLBへ出力する建物がありません。');
  const unit = options.unit ?? 'mm';
  const attribution = options.attribution ?? '国土交通省 PLATEAU';
  const nodePrefix = options.nodePrefix ?? 'PLATEAU';
  const unitScale = { m: 1, cm: 100, mm: 1000 }[unit];
  if (!unitScale) throw new RangeError(`未対応の出力単位です: ${unit}`);
  const bufferViews = [], accessors = [], meshes = [], nodes = [];
  const chunks = [];
  let binaryLength = 0;
  for (const building of buildings) {
    const positions = unitScale === 1 ? building.positions : Float32Array.from(building.positions, value => value * unitScale);
    const arrays = [positions, building.indices];
    const viewStart = bufferViews.length;
    for (const [index, array] of arrays.entries()) {
      binaryLength = align4(binaryLength);
      chunks.push({ offset: binaryLength, array });
      bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: array.byteLength, target: index === 0 ? 34962 : 34963 });
      binaryLength += array.byteLength;
    }
    const { min, max } = minMaxVec3(positions);
    const accessorStart = accessors.length;
    accessors.push(
      { bufferView: viewStart, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: viewStart + 1, componentType: building.indices instanceof Uint32Array ? 5125 : 5123, count: building.indices.length, type: 'SCALAR' }
    );
    meshes.push({ primitives: [{ attributes: { POSITION: accessorStart }, indices: accessorStart + 1, material: 0, mode: 4 }] });
    const node = { mesh: meshes.length - 1, name: `${nodePrefix} ${building.code}` };
    if (unitScale !== 1) node.scale = [1 / unitScale, 1 / unitScale, 1 / unitScale];
    nodes.push(node);
  }
  binaryLength = align4(binaryLength);
  const binary = new Uint8Array(binaryLength);
  for (const chunk of chunks) binary.set(new Uint8Array(chunk.array.buffer, chunk.array.byteOffset, chunk.array.byteLength), chunk.offset);
  const json = {
    asset: { version: '2.0', generator: 'ちずつく v1.1.0 / Kuwa-ya, Ltd.', extras: {
      productName: 'ちずつく', creator: 'Kuwa-ya, Ltd.', applicationVersion: 'v1.1.0', attribution, unit,
      geographicCrs: 'EPSG:6668', jprcZone: options.zone,
      originLatitude: options.origin?.latitude, originLongitude: options.origin?.longitude,
      originAltitude: options.origin?.altitude ?? 0,
      coordinateSystem: 'JPRC_LOCAL_Y_UP', axisMapping: 'X=EAST,Y=UP,Z=SOUTH'
    } },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes, meshes,
    materials: [{ name: 'PLATEAU building', pbrMetallicRoughness: { baseColorFactor: [0.65, 0.68, 0.67, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: false }],
    buffers: [{ byteLength: binaryLength }], bufferViews, accessors
  };
  const jsonBytes = encoder.encode(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.length);
  const total = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = new ArrayBuffer(total), view = new DataView(output), bytes = new Uint8Array(output);
  let offset = 0;
  for (const value of [GLB_MAGIC, 2, total, jsonLength, JSON_CHUNK]) { view.setUint32(offset, value, true); offset += 4; }
  bytes.fill(0x20, offset, offset + jsonLength); bytes.set(jsonBytes, offset); offset += jsonLength;
  view.setUint32(offset, binaryLength, true); offset += 4; view.setUint32(offset, BIN_CHUNK, true); offset += 4; bytes.set(binary, offset);
  return output;
}

export function downloadBuildingGlb(buildings, options = {}) {
  const unit = options.unit ?? 'mm';
  const data = createBuildingGlb(buildings, { ...options, unit });
  return downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `buildings_${buildings.length}meshes_${unit}.glb`);
}

export function downloadTransportGlb(surfaces, options = {}) {
  const unit = options.unit ?? 'mm';
  const data = createBuildingGlb(surfaces, { ...options, unit, nodePrefix: 'PLATEAU tran', attribution: '国土交通省 PLATEAU' });
  return downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `transport_${surfaces.length}meshes_${unit}.glb`);
}
