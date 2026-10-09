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

import { thirdMeshBounds } from '../geometric/japan-mesh-code.js';
import { createDemElevationSampler, DEM_TILE_SIZE } from '../domain/terrain.js?v=20260926-4';

export const CITYGML_DEM_LODS = Object.freeze({
  1: { lod: 1, pixelStep: 4, label: 'LOD1（DEM1A 1/4）' },
  2: { lod: 2, pixelStep: 2, label: 'LOD2（DEM1A 1/2）' },
  3: { lod: 3, pixelStep: 1, label: 'LOD3（DEM1A 純粋）' }
});

/** LOD別の三次メッシュ件数上限（初期は容量を抑える） */
export const CITYGML_MESH_LIMITS = Object.freeze({ 1: 4, 2: 2, 3: 1 });

const ASSET_FILES = Object.freeze([
  'schemas/iur/uro/3.2/urbanObject.xsd',
  'codelists/DataQualityAttribute_geometrySrcDesc.xml',
  'codelists/DataQualityAttribute_thematicSrcDesc.xml',
  'codelists/PublicSurveyDataQualityAttribute_geometrySrcDesc.xml',
  'codelists/PublicSurveyDataQualityAttribute_srcScale.xml'
]);

const assetCache = new Map();

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatCoord(value) {
  return Number(value).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

function formatHeight(value) {
  return Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function globalPixelToLatLon(globalX, globalY, zoom) {
  const scale = 2 ** zoom * DEM_TILE_SIZE;
  const longitude = globalX / scale * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * globalY / scale))) * 180 / Math.PI;
  return { latitude, longitude };
}

export function createValidTerrainTopology(elevations, rows, columns) {
  const indices = [];
  const referencedVertices = new Set();
  const appendTriangle = (a, b, c) => {
    if (![a, b, c].every(index => Number.isFinite(elevations[index]))) return;
    indices.push(a, b, c);
    referencedVertices.add(a);
    referencedVertices.add(b);
    referencedVertices.add(c);
  };
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      appendTriangle(topLeft, bottomLeft, topRight);
      appendTriangle(bottomRight, topRight, bottomLeft);
    }
  }
  return { indices, referencedVertices };
}

/**
 * 内部＝ウェブメルカトル格子、外周＝三次メッシュ境界上の調整点。
 */
export async function buildCityGmlDemGrid(sampler, meshCode, cityGmlLod) {
  const setting = CITYGML_DEM_LODS[cityGmlLod];
  if (!setting) throw new RangeError(`未対応のCityGML DEM LODです: ${cityGmlLod}`);
  const bounds = thirdMeshBounds(meshCode);
  const zoom = sampler.DEM1A_ZOOM;
  const step = setting.pixelStep;
  const eps = 1e-12;

  const nw = sampler.latLonToGlobalPixel(bounds.north - eps, bounds.west + eps, zoom);
  const se = sampler.latLonToGlobalPixel(bounds.south + eps, bounds.east - eps, zoom);
  const minPX = Math.ceil(Math.min(nw.x, se.x) / step) * step;
  const maxPX = Math.floor(Math.max(nw.x, se.x) / step) * step;
  const minPY = Math.ceil(Math.min(nw.y, se.y) / step) * step;
  const maxPY = Math.floor(Math.max(nw.y, se.y) / step) * step;

  const interiorLons = [];
  const interiorLats = [];
  const interiorLonSet = new Set();
  const interiorLatSet = new Set();

  for (let px = minPX; px <= maxPX; px += step) {
    for (let py = minPY; py <= maxPY; py += step) {
      const { latitude, longitude } = globalPixelToLatLon(px + 0.5, py + 0.5, zoom);
      if (latitude <= bounds.south || latitude >= bounds.north) continue;
      if (longitude <= bounds.west || longitude >= bounds.east) continue;
      const lonKey = longitude.toFixed(12);
      const latKey = latitude.toFixed(12);
      if (!interiorLonSet.has(lonKey)) {
        interiorLonSet.add(lonKey);
        interiorLons.push(longitude);
      }
      if (!interiorLatSet.has(latKey)) {
        interiorLatSet.add(latKey);
        interiorLats.push(latitude);
      }
    }
  }

  interiorLons.sort((a, b) => a - b);
  interiorLats.sort((a, b) => b - a); // north → south

  const lonList = [bounds.west, ...interiorLons, bounds.east];
  const latList = [bounds.north, ...interiorLats, bounds.south];
  const columns = lonList.length;
  const rows = latList.length;
  if (columns < 2 || rows < 2) {
    throw new Error(`三次メッシュ ${meshCode} に有効な格子を生成できませんでした。`);
  }

  const elevations = new Float64Array(rows * columns);
  const latitudes = new Float64Array(rows * columns);
  const longitudes = new Float64Array(rows * columns);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const latitude = latList[row];
      const longitude = lonList[column];
      const index = row * columns + column;
      latitudes[index] = latitude;
      longitudes[index] = longitude;
      elevations[index] = await sampler.sample(latitude, longitude);
    }
  }

  const { indices, referencedVertices } = createValidTerrainTopology(elevations, rows, columns);

  let elevationMin = Infinity;
  let elevationMax = -Infinity;
  let latitudeMin = Infinity;
  let latitudeMax = -Infinity;
  let longitudeMin = Infinity;
  let longitudeMax = -Infinity;
  for (const index of referencedVertices) {
    const value = elevations[index];
    elevationMin = Math.min(elevationMin, value);
    elevationMax = Math.max(elevationMax, value);
    latitudeMin = Math.min(latitudeMin, latitudes[index]);
    latitudeMax = Math.max(latitudeMax, latitudes[index]);
    longitudeMin = Math.min(longitudeMin, longitudes[index]);
    longitudeMax = Math.max(longitudeMax, longitudes[index]);
  }

  const referenced = [...referencedVertices].sort((a, b) => a - b);
  const remap = new Map(referenced.map((sourceIndex, outputIndex) => [sourceIndex, outputIndex]));
  const outputLatitudes = new Float64Array(referenced.length);
  const outputLongitudes = new Float64Array(referenced.length);
  const outputElevations = new Float64Array(referenced.length);
  for (let index = 0; index < referenced.length; index += 1) {
    const sourceIndex = referenced[index];
    outputLatitudes[index] = latitudes[sourceIndex];
    outputLongitudes[index] = longitudes[sourceIndex];
    outputElevations[index] = elevations[sourceIndex];
  }
  const outputIndices = new Uint32Array(indices.map(index => remap.get(index)));

  return {
    meshCode,
    cityGmlLod: setting.lod,
    bounds,
    rows,
    columns,
    latitudes: outputLatitudes,
    longitudes: outputLongitudes,
    elevations: outputElevations,
    indices: outputIndices,
    sampleCount: rows * columns,
    vertexCount: referencedVertices.size,
    triangleCount: outputIndices.length / 3,
    elevationMin,
    elevationMax,
    outputBounds: referencedVertices.size > 0 ? {
      south: latitudeMin,
      north: latitudeMax,
      west: longitudeMin,
      east: longitudeMax
    } : null
  };
}

function trianglePosList(grid, a, b, c) {
  const points = [a, b, c, a];
  return points.map(index => {
    const lat = formatCoord(grid.latitudes[index]);
    const lon = formatCoord(grid.longitudes[index]);
    const height = formatHeight(grid.elevations[index]);
    return `${lat} ${lon} ${height}`;
  }).join(' ');
}

function dataQualityXml(lod) {
  const additionalGeometrySource = lod === 1
    ? ''
    : `          <uro:geometrySrcDescLod${lod} codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod${lod}>\n`;
  return '      <uro:demDataQualityAttribute>\n'
    + '        <uro:DataQualityAttribute>\n'
    // urbanObject.xsd requires Lod1; higher-density outputs additionally identify their selected LOD.
    + '          <uro:geometrySrcDescLod1 codeSpace="../../codelists/DataQualityAttribute_geometrySrcDesc.xml">000</uro:geometrySrcDescLod1>\n'
    + additionalGeometrySource
    + '          <uro:thematicSrcDesc codeSpace="../../codelists/DataQualityAttribute_thematicSrcDesc.xml">700</uro:thematicSrcDesc>\n'
    + '          <uro:publicSurveyDataQualityAttribute>\n'
    + '            <uro:PublicSurveyDataQualityAttribute>\n'
    + `              <uro:srcScaleLod${lod} codeSpace="../../codelists/PublicSurveyDataQualityAttribute_srcScale.xml">1</uro:srcScaleLod${lod}>\n`
    + `              <uro:publicSurveySrcDescLod${lod} codeSpace="../../codelists/PublicSurveyDataQualityAttribute_geometrySrcDesc.xml">012</uro:publicSurveySrcDescLod${lod}>\n`
    + '            </uro:PublicSurveyDataQualityAttribute>\n'
    + '          </uro:publicSurveyDataQualityAttribute>\n'
    + '        </uro:DataQualityAttribute>\n'
    + '      </uro:demDataQualityAttribute>\n';
}

const TRIANGLE_BATCH_SIZE = 1500;
const textEncoder = new TextEncoder();

function pushUtf8(parts, text) {
  parts.push(textEncoder.encode(text));
}

async function yieldToUi() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/** 巨大な1文字列を作らず、Blob部品としてCityGMLを組み立てる。 */
export async function createCityGmlDemDocumentBlob(grids, { creationDate = new Date(), onProgress } = {}) {
  if (!grids.length) throw new Error('CityGMLへ出力するDEMがありません。');
  const dateText = creationDate.toISOString().slice(0, 10);
  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  let hMin = Infinity;
  let hMax = -Infinity;
  let totalTriangles = 0;
  for (const grid of grids) {
    const outputBounds = grid.outputBounds ?? grid.bounds;
    latMin = Math.min(latMin, outputBounds.south);
    latMax = Math.max(latMax, outputBounds.north);
    lonMin = Math.min(lonMin, outputBounds.west);
    lonMax = Math.max(lonMax, outputBounds.east);
    hMin = Math.min(hMin, grid.elevationMin);
    hMax = Math.max(hMax, grid.elevationMax);
    totalTriangles += grid.triangleCount;
  }

  const parts = [];
  pushUtf8(parts, '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<core:CityModel\n'
    + '  xmlns:gml="http://www.opengis.net/gml"\n'
    + '  xmlns:core="http://www.opengis.net/citygml/2.0"\n'
    + '  xmlns:dem="http://www.opengis.net/citygml/relief/2.0"\n'
    + '  xmlns:uro="https://www.geospatial.jp/iur/uro/3.2"\n'
    + '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
    + '  xsi:schemaLocation="http://www.opengis.net/citygml/2.0 http://schemas.opengis.net/citygml/2.0/cityGMLBase.xsd\n'
    + '    http://www.opengis.net/citygml/relief/2.0 http://schemas.opengis.net/citygml/relief/2.0/relief.xsd\n'
    + '    http://www.opengis.net/gml http://schemas.opengis.net/gml/3.1.1/base/gml.xsd\n'
    + '    https://www.geospatial.jp/iur/uro/3.2 ../../schemas/iur/uro/3.2/urbanObject.xsd">\n'
    + '  <!-- Generated by ちずうつし / Kuwa-ya, Ltd. from GSI DEM1A. Not an official PLATEAU product. -->\n'
    + '  <gml:boundedBy>\n'
    + '    <gml:Envelope srsName="http://www.opengis.net/def/crs/EPSG/0/6697" srsDimension="3">\n'
    + `      <gml:lowerCorner>${formatCoord(latMin)} ${formatCoord(lonMin)} ${formatHeight(hMin)}</gml:lowerCorner>\n`
    + `      <gml:upperCorner>${formatCoord(latMax)} ${formatCoord(lonMax)} ${formatHeight(hMax)}</gml:upperCorner>\n`
    + '    </gml:Envelope>\n'
    + '  </gml:boundedBy>\n');

  let writtenTriangles = 0;
  for (const grid of grids) {
    const featureId = createId('dem');
    const tinId = createId('dem');
    pushUtf8(parts,
      '  <core:cityObjectMember>\n'
      + `    <dem:ReliefFeature gml:id="${featureId}">\n`
      + `      <gml:name>${escapeXml(grid.meshCode)}</gml:name>\n`
      + `      <core:creationDate>${dateText}</core:creationDate>\n`
      + `      <dem:lod>${grid.cityGmlLod}</dem:lod>\n`
      + '      <dem:reliefComponent>\n'
      + `        <dem:TINRelief gml:id="${tinId}">\n`
      + `          <gml:name>${escapeXml(grid.meshCode)}</gml:name>\n`
      + `          <core:creationDate>${dateText}</core:creationDate>\n`
      + `          <dem:lod>${grid.cityGmlLod}</dem:lod>\n`
      + '          <dem:tin>\n'
      + '            <gml:TriangulatedSurface>\n'
      + '              <gml:trianglePatches>\n');

    for (let index = 0; index < grid.indices.length; index += TRIANGLE_BATCH_SIZE * 3) {
      const end = Math.min(grid.indices.length, index + TRIANGLE_BATCH_SIZE * 3);
      let batch = '';
      for (let cursor = index; cursor < end; cursor += 3) {
        const a = grid.indices[cursor];
        const b = grid.indices[cursor + 1];
        const c = grid.indices[cursor + 2];
        batch += '                <gml:Triangle>\n'
          + '                  <gml:exterior>\n'
          + '                    <gml:LinearRing>\n'
          + `                      <gml:posList>${trianglePosList(grid, a, b, c)}</gml:posList>\n`
          + '                    </gml:LinearRing>\n'
          + '                  </gml:exterior>\n'
          + '                </gml:Triangle>\n';
      }
      pushUtf8(parts, batch);
      writtenTriangles += (end - index) / 3;
      onProgress?.(`CityGML XMLを生成中… ${Math.min(100, Math.round(writtenTriangles / totalTriangles * 100))}%`);
      await yieldToUi();
    }

    pushUtf8(parts,
      '              </gml:trianglePatches>\n'
      + '            </gml:TriangulatedSurface>\n'
      + '          </dem:tin>\n'
      + '        </dem:TINRelief>\n'
      + '      </dem:reliefComponent>\n'
      + dataQualityXml(grid.cityGmlLod)
      + '    </dem:ReliefFeature>\n'
      + '  </core:cityObjectMember>\n');
  }

  pushUtf8(parts, '</core:CityModel>\n');
  return new Blob(parts, { type: 'application/xml;charset=utf-8' });
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32Bytes(bytes, crc = 0xffffffff) {
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

async function crc32Blob(blob) {
  let crc = 0xffffffff;
  const reader = blob.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    crc = crc32Bytes(value, crc);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(text) {
  return textEncoder.encode(text);
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** 無圧縮（STORE）ZIP。巨大エントリはBlobのまま連結し、単一巨大Uint8Arrayを避ける。 */
export async function createZipArchive(entries) {
  const zipParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const dataBlob = entry.data instanceof Blob
      ? entry.data
      : new Blob([entry.data instanceof Uint8Array ? entry.data : encodeUtf8(entry.data)]);
    const size = dataBlob.size;
    const crc = await crc32Blob(dataBlob);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true); // general purpose bit flag
    localView.setUint16(8, 0, true); // compression method = STORE
    localView.setUint16(10, 0, true); // mod time
    localView.setUint16(12, 0, true); // mod date
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true); // compressed size
    localView.setUint32(22, size, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true); // file name length
    localView.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);
    zipParts.push(local, dataBlob);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(8, 0, true); // general purpose
    centralView.setUint16(10, 0, true); // compression = STORE
    centralView.setUint16(12, 0, true); // mod time
    centralView.setUint16(14, 0, true); // mod date
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true); // extra
    centralView.setUint16(32, 0, true); // comment
    centralView.setUint16(34, 0, true); // disk start
    centralView.setUint16(36, 0, true); // internal attrs
    centralView.setUint32(38, 0, true); // external attrs
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + size;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  zipParts.push(centralDirectory, end);
  return new Blob(zipParts, { type: 'application/zip' });
}

async function loadAssetBytes(relativePath) {
  if (assetCache.has(relativePath)) return assetCache.get(relativePath);
  const response = await fetch(`./citygml-assets/${relativePath}`);
  if (!response.ok) throw new Error(`CityGML資産の取得に失敗しました: ${relativePath}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assetCache.set(relativePath, bytes);
  return bytes;
}

export async function buildCityGmlDemZipEntries(meshGridsByCode, { onProgress } = {}) {
  const entries = [];
  for (const [meshCode, grids] of meshGridsByCode) {
    onProgress?.(`${meshCode} のCityGMLを組み立てています…`);
    const xmlBlob = await createCityGmlDemDocumentBlob(grids, { onProgress });
    entries.push({ name: `udx/dem/${meshCode}_dem_6697_op.gml`, data: xmlBlob });
  }
  for (const relativePath of ASSET_FILES) {
    entries.push({ name: relativePath, data: await loadAssetBytes(relativePath) });
  }
  return entries;
}

export async function prepareCityGmlDemExport(loader, {
  meshCodes,
  cityGmlLod,
  onProgress,
  sampler = createDemElevationSampler(loader, { missingValue: Number.NaN }),
  gridBuilder = buildCityGmlDemGrid
} = {}) {
  const setting = CITYGML_DEM_LODS[cityGmlLod];
  if (!setting) throw new RangeError(`未対応のCityGML DEM LODです: ${cityGmlLod}`);
  if (!meshCodes?.length) throw new Error('出力する三次メッシュがありません。');
  const limit = CITYGML_MESH_LIMITS[cityGmlLod];
  if (meshCodes.length > limit) {
    throw new RangeError(`CityGML DEM LOD${cityGmlLod}の対象は${meshCodes.length}三次メッシュです。${limit}メッシュ以内に範囲を狭めてください。`);
  }

  const meshGridsByCode = new Map();
  const excludedMeshCodes = [];
  let vertexCount = 0;
  let triangleCount = 0;
  for (let index = 0; index < meshCodes.length; index += 1) {
    const meshCode = meshCodes[index];
    onProgress?.(`三次メッシュ ${meshCode}（${index + 1}/${meshCodes.length}）の格子を生成しています…`);
    const grid = await gridBuilder(sampler, meshCode, cityGmlLod);
    if (grid.triangleCount === 0) {
      excludedMeshCodes.push(meshCode);
      await yieldToUi();
      continue;
    }
    meshGridsByCode.set(meshCode, [grid]);
    vertexCount += grid.vertexCount;
    triangleCount += grid.triangleCount;
    await yieldToUi();
  }

  if (meshGridsByCode.size === 0) {
    throw new Error('有効な標高データがないためCityGMLを生成できません。');
  }

  const outputMeshCodes = [...meshGridsByCode.keys()];

  return {
    cityGmlLod: setting.lod,
    label: setting.label,
    meshCodes: outputMeshCodes,
    requestedMeshCodes: [...meshCodes],
    excludedMeshCodes,
    meshGridsByCode,
    vertexCount,
    triangleCount,
    meshCount: outputMeshCodes.length,
    requestedMeshCount: meshCodes.length,
    excludedMeshCount: excludedMeshCodes.length
  };
}

export async function downloadCityGmlDemZip(prepared, { onProgress } = {}) {
  onProgress?.('CityGML ZIPを生成しています…');
  const entries = await buildCityGmlDemZipEntries(prepared.meshGridsByCode, { onProgress });
  onProgress?.('ZIPを結合しています…');
  const blob = await createZipArchive(entries);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const meshPart = prepared.meshCodes.length === 1
    ? prepared.meshCodes[0]
    : `${prepared.meshCodes.length}meshes`;
  anchor.href = url;
  anchor.download = `dem_${meshPart}_lod${prepared.cityGmlLod}_citygml.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
  return blob.size;
}

export function estimateCityGmlStats(meshCount, cityGmlLod) {
  const setting = CITYGML_DEM_LODS[cityGmlLod];
  // 三次メッシュ約1km四方、DEM1A約1m → 辺あたり ~1000/step 点
  const edge = Math.ceil(1000 / setting.pixelStep) + 2;
  const vertices = edge * edge * meshCount;
  const triangles = (edge - 1) * (edge - 1) * 2 * meshCount;
  return { vertices, triangles, limit: CITYGML_MESH_LIMITS[cityGmlLod] };
}
