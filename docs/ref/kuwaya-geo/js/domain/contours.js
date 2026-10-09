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

import { chainSegments, pointKeyXYZ } from './polylines.js';

function vertexAt(positions, index) {
  const offset = index * 3;
  return { x: positions[offset], y: positions[offset + 1], z: positions[offset + 2] };
}

function intersection(first, second, height) {
  const ratio = (height - first.y) / (second.y - first.y);
  return {
    x: first.x + (second.x - first.x) * ratio,
    y: height,
    z: first.z + (second.z - first.z) * ratio
  };
}

export function buildContourSegments(terrain, interval) {
  if (!Number.isFinite(interval) || interval <= 0) return [];
  const segments = [];
  const { positions, indices } = terrain;
  for (let index = 0; index < indices.length; index += 3) {
    const vertices = [
      vertexAt(positions, indices[index]),
      vertexAt(positions, indices[index + 1]),
      vertexAt(positions, indices[index + 2])
    ];
    const minimum = Math.min(...vertices.map(vertex => vertex.y));
    const maximum = Math.max(...vertices.map(vertex => vertex.y));
    if (maximum <= minimum) continue;
    const firstStep = Math.ceil((minimum + Number.EPSILON) / interval);
    const lastStep = Math.floor((maximum - Number.EPSILON) / interval);
    for (let step = firstStep; step <= lastStep; step += 1) {
      const height = step * interval;
      const points = [];
      for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
        const first = vertices[start];
        const second = vertices[end];
        if (first.y === second.y) continue;
        const edgeMinimum = Math.min(first.y, second.y);
        const edgeMaximum = Math.max(first.y, second.y);
        if (height < edgeMinimum || height >= edgeMaximum) continue;
        points.push(intersection(first, second, height));
      }
      if (points.length === 2) {
        const lengthSquared = (points[1].x - points[0].x) ** 2 + (points[1].z - points[0].z) ** 2;
        if (lengthSquared > 1e-10) segments.push({ start: points[0], end: points[1], height, tile: terrain.tile });
      }
    }
  }
  return segments;
}

/** 同一標高で端点が接する線分をつなぎ、1本のポリラインにする。 */
export function chainContourSegments(segments) {
  return chainSegments(segments, {
    groupKey: segment => `${segment.height}`,
    pointKey: pointKeyXYZ
  });
}
