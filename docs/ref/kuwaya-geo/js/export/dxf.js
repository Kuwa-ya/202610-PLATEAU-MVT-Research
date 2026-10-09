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

import { chainContourSegments } from '../domain/contours.js';
import {
  cancelSharedEdges,
  chainSegments,
  flattenPolylinesToSegments,
  pointKeyXZ
} from '../domain/polylines.js';

function dxfNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob.size;
}

function unitScaleOf(unit) {
  const unitScale = { m: 1, cm: 100, mm: 1000 }[unit];
  if (!unitScale) throw new RangeError(`未対応の出力単位です: ${unit}`);
  return unitScale;
}

function insertionUnitOf(unit) {
  return { m: 6, cm: 5, mm: 4 }[unit];
}

function appendPolyline(lines, polyline, {
  layer,
  color,
  unitScale,
  elevation = point => point.y
}) {
  const { points, closed } = polyline;
  if (points.length < 2) return;
  lines.push(
    '0', 'POLYLINE', '8', layer,
    '62', `${color}`,
    '66', '1',
    '70', closed ? '1' : '0'
  );
  for (const point of points) {
    lines.push(
      '0', 'VERTEX', '8', layer,
      '10', dxfNumber(point.x * unitScale),
      '20', dxfNumber(-point.z * unitScale),
      '30', dxfNumber(elevation(point) * unitScale)
    );
  }
  lines.push('0', 'SEQEND');
}

export function createContourDxf(segments, metadata = {}) {
  const majorEvery = metadata.majorEvery ?? 5;
  const interval = metadata.interval ?? 1;
  const minorColor = metadata.minorColor ?? 8;
  const majorColor = metadata.majorColor ?? 5;
  const unit = metadata.unit ?? 'mm';
  const unitScale = unitScaleOf(unit);
  const insertionUnit = insertionUnitOf(unit);
  const polylines = chainContourSegments(segments);
  const lines = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', `${insertionUnit}`,
    '999', 'Product=ちずうつし v1.1.0 / Creator=Kuwa-ya, Ltd.',
    '999', `CRS=${metadata.crs ?? 'EPSG:6668'} / JPRC zone=${metadata.zone ?? ''}`,
    '999', `Local origin lat=${metadata.origin?.latitude ?? ''}, lon=${metadata.origin?.longitude ?? ''}, altitude=${metadata.origin?.altitude ?? 0}`,
    '999', `Axis X=EAST, Y=NORTH, Z=ELEVATION; unit=${unit}`,
    '999', 'Contours chained into POLYLINE where endpoints meet at the same elevation',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'
  ];

  for (const polyline of polylines) {
    const contourNumber = Math.round(polyline.height / interval);
    const isMajor = Math.abs(contourNumber) % majorEvery === 0;
    appendPolyline(lines, polyline, {
      layer: isMajor ? 'CONTOUR_MAJOR' : 'CONTOUR_MINOR',
      color: isMajor ? majorColor : minorColor,
      unitScale,
      elevation: () => polyline.height
    });
  }

  const labelHeight = metadata.labelHeight ?? Math.max(1, (metadata.interval ?? 10) * 0.3);
  for (const polyline of polylines) {
    const contourNumber = Math.round(polyline.height / interval);
    if (Math.abs(contourNumber) % majorEvery !== 0) continue;
    if (polyline.points.length < 2) continue;
    const first = polyline.points[0];
    const second = polyline.points[1];
    const x = (first.x + second.x) / 2;
    const y = -(first.z + second.z) / 2;
    let angle = Math.atan2(-(second.z - first.z), second.x - first.x) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    lines.push(
      '0', 'TEXT', '8', 'CONTOUR_LABEL',
      '62', `${majorColor}`,
      '10', dxfNumber(x * unitScale),
      '20', dxfNumber(y * unitScale),
      '30', dxfNumber(polyline.height * unitScale),
      '40', dxfNumber(labelHeight * unitScale),
      '1', `${Number(polyline.height).toFixed(1)} m`,
      '50', dxfNumber(angle)
    );
  }
  lines.push('0', 'ENDSEC', '0', 'EOF', '');
  return lines.join('\r\n');
}

export function downloadContourDxf(segments, metadata) {
  if (segments.length === 0) throw new Error('DXFへ出力する等高線がありません。');
  const polylines = chainContourSegments(segments);
  const blob = new Blob([createContourDxf(segments, metadata)], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const tileMap = new Map();
  for (const tile of metadata.tiles ?? segments.map(segment => segment.tile)) {
    if (!tile) continue;
    tileMap.set(`${tile.z}/${tile.x}/${tile.y}`, tile);
  }
  const tiles = [...tileMap.values()];
  const zoom = tiles[0]?.z ?? metadata.detailLevel ?? 'unknown';
  const tilePart = tiles.length === 0
    ? 'terrain'
    : tiles.length === 1
      ? `${tiles[0].x}_${tiles[0].y}`
      : `${tiles.length}tiles_x${Math.min(...tiles.map(tile => tile.x))}-${Math.max(...tiles.map(tile => tile.x))}_y${Math.min(...tiles.map(tile => tile.y))}-${Math.max(...tiles.map(tile => tile.y))}`;
  anchor.download = `contours_z${zoom}_${tilePart}_${metadata.interval}m_${metadata.unit ?? 'mm'}.dxf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { size: blob.size, polylineCount: polylines.length, segmentCount: segments.length };
}

export function createBuildingFootprintDxf(buildings, options = {}) {
  const unit = options.unit ?? 'mm';
  const source = options.source ?? '国土交通省 PLATEAU';
  const layer = options.layer ?? 'BUILDING_FOOTPRINT';
  const unitScale = unitScaleOf(unit);
  const insertionUnit = insertionUnitOf(unit);
  const lines = ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70',String(insertionUnit),
    '999','Product=ちずうつし v1.1.0 / Creator=Kuwa-ya, Ltd.','999',`Source=${source}`,'999','Planar outlines; Z=0',
    '999',`CRS=EPSG:6668 / JPRC zone=${options.zone ?? ''}`,
    '999',`Local origin lat=${options.origin?.latitude ?? ''}, lon=${options.origin?.longitude ?? ''}, altitude=${options.origin?.altitude ?? 0}`,
    '0','ENDSEC','0','SECTION','2','ENTITIES'];
  for (const building of buildings) for (const segment of building.footprintSegments) lines.push(
    '0','LINE','8',layer,'62','7',
    '10',dxfNumber(segment.start.x * unitScale),'20',dxfNumber(-segment.start.z * unitScale),'30','0',
    '11',dxfNumber(segment.end.x * unitScale),'21',dxfNumber(-segment.end.z * unitScale),'31','0'
  );
  lines.push('0','ENDSEC','0','EOF','');
  return lines.join('\r\n');
}

export function downloadBuildingFootprintDxf(buildings, options = {}) {
  const segmentCount = buildings.reduce((sum, building) => sum + building.footprintSegments.length, 0);
  if (segmentCount === 0) throw new Error('DXFへ出力する建物外形線がありません。');
  const unit = options.unit ?? 'mm';
  const blob = new Blob([createBuildingFootprintDxf(buildings, { ...options, unit })], { type: 'application/dxf;charset=utf-8' });
  return downloadBlob(blob, `building_footprints_${buildings.length}meshes_${unit}.dxf`);
}

/** 全交通面の外形線から共有辺を打ち消し、残辺をポリライン化する。 */
export function buildTransportOutlinePolylines(surfaces) {
  const remaining = cancelSharedEdges(
    surfaces.flatMap(surface => surface.footprintSegments ?? []),
    pointKeyXZ
  );
  return chainSegments(remaining, { groupKey: () => 'tran', pointKey: pointKeyXZ });
}

export function createTransportOutlineDxf(surfaces, options = {}) {
  const unit = options.unit ?? 'mm';
  const unitScale = unitScaleOf(unit);
  const insertionUnit = insertionUnitOf(unit);
  const polylines = buildTransportOutlinePolylines(surfaces);
  const lines = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', String(insertionUnit),
    '999', 'Product=ちずうつし v1.1.0 / Creator=Kuwa-ya, Ltd.',
    '999', 'Source=国土交通省 PLATEAU',
    '999', 'Transport outlines after shared-edge cancel; Z=0; POLYLINE',
    '999', `CRS=EPSG:6668 / JPRC zone=${options.zone ?? ''}`,
    '999', `Local origin lat=${options.origin?.latitude ?? ''}, lon=${options.origin?.longitude ?? ''}, altitude=${options.origin?.altitude ?? 0}`,
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'
  ];
  for (const polyline of polylines) {
    appendPolyline(lines, polyline, {
      layer: 'TRAN_OUTLINE',
      color: 7,
      unitScale,
      elevation: () => 0
    });
  }
  lines.push('0', 'ENDSEC', '0', 'EOF', '');
  return { text: lines.join('\r\n'), polylines };
}

export function downloadTransportDxf(surfaces, options = {}) {
  const { text, polylines } = createTransportOutlineDxf(surfaces, options);
  if (polylines.length === 0) throw new Error('DXFへ出力する道路外形線がありません。');
  const unit = options.unit ?? 'mm';
  const size = downloadBlob(new Blob([text], { type: 'application/dxf;charset=utf-8' }), `transport_outlines_${surfaces.length}meshes_${unit}.dxf`);
  return {
    size,
    polylineCount: polylines.length,
    segmentCount: flattenPolylinesToSegments(polylines).length
  };
}
