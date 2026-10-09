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

/** 平面外形用の端点キー（X/Z、ミリメートル相当）。 */
export function pointKeyXZ(point, digits = 3) {
  return `${point.x.toFixed(digits)},${point.z.toFixed(digits)}`;
}

/** 等高線用の端点キー（X/Y/Z）。 */
export function pointKeyXYZ(point, digits = 3) {
  return `${point.x.toFixed(digits)},${point.y.toFixed(digits)},${point.z.toFixed(digits)}`;
}

function undirectedEdgeKey(startKey, endKey) {
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

/**
 * 同一辺が偶数回現れたら打ち消し、奇数回なら1本残す。
 * 隣接ポリゴンの共有辺除去に使う。真の面結合（boolean union）は行わない。
 */
export function cancelSharedEdges(segments, keyFn = pointKeyXZ) {
  const edges = new Map();
  for (const segment of segments) {
    const startKey = keyFn(segment.start);
    const endKey = keyFn(segment.end);
    if (startKey === endKey) continue;
    const edgeKey = undirectedEdgeKey(startKey, endKey);
    const entry = edges.get(edgeKey);
    if (entry) entry.count += 1;
    else edges.set(edgeKey, { count: 1, segment });
  }
  return [...edges.values()].filter(entry => entry.count % 2 === 1).map(entry => entry.segment);
}

function chainGroup(segments, keyFn) {
  if (segments.length === 0) return [];

  const adjacency = new Map();
  const unused = new Set();

  const addEdge = (fromKey, toKey, edgeId, point) => {
    if (!adjacency.has(fromKey)) adjacency.set(fromKey, []);
    adjacency.get(fromKey).push({ toKey, edgeId, point });
  };

  segments.forEach((segment, edgeId) => {
    const startKey = keyFn(segment.start);
    const endKey = keyFn(segment.end);
    if (startKey === endKey) return;
    unused.add(edgeId);
    addEdge(startKey, endKey, edgeId, segment.end);
    addEdge(endKey, startKey, edgeId, segment.start);
  });

  const degree = key => (adjacency.get(key) ?? []).filter(link => unused.has(link.edgeId)).length;

  const takeLink = (fromKey, preferredEdgeId = null) => {
    const links = adjacency.get(fromKey) ?? [];
    const link = preferredEdgeId == null
      ? links.find(item => unused.has(item.edgeId))
      : links.find(item => item.edgeId === preferredEdgeId && unused.has(item.edgeId))
        ?? links.find(item => unused.has(item.edgeId));
    if (!link) return null;
    unused.delete(link.edgeId);
    return link;
  };

  const walk = (startKey, firstEdgeId = null) => {
    const startPoint = (() => {
      const links = adjacency.get(startKey) ?? [];
      const seed = links.find(link => link.edgeId === firstEdgeId) ?? links[0];
      if (!seed) return null;
      const segment = segments[seed.edgeId];
      return keyFn(segment.start) === startKey ? segment.start : segment.end;
    })();
    if (!startPoint) return null;

    const points = [startPoint];
    let currentKey = startKey;
    let next = takeLink(currentKey, firstEdgeId);
    while (next) {
      points.push(next.point);
      currentKey = next.toKey;
      if (currentKey === startKey) break;
      next = takeLink(currentKey);
    }
    return points;
  };

  const polylines = [];
  while (unused.size > 0) {
    let startKey = null;
    let firstEdgeId = null;
    for (const edgeId of unused) {
      const segment = segments[edgeId];
      const start = keyFn(segment.start);
      const end = keyFn(segment.end);
      if (degree(start) === 1) {
        startKey = start;
        firstEdgeId = edgeId;
        break;
      }
      if (degree(end) === 1) {
        startKey = end;
        firstEdgeId = edgeId;
        break;
      }
    }
    if (startKey == null) {
      const edgeId = unused.values().next().value;
      const segment = segments[edgeId];
      startKey = keyFn(segment.start);
      firstEdgeId = edgeId;
    }
    const points = walk(startKey, firstEdgeId);
    if (!points || points.length < 2) continue;
    const closed = points.length > 2 && keyFn(points[0]) === keyFn(points.at(-1));
    if (closed) points.pop();
    polylines.push({ points, closed });
  }
  return polylines;
}

/**
 * 線分を端点接続でポリライン化する。
 * groupKey が同じ線分だけをつなぐ（等高線では標高ごと）。
 */
export function chainSegments(segments, { groupKey = () => '', pointKey = pointKeyXZ } = {}) {
  const groups = new Map();
  for (const segment of segments) {
    const key = groupKey(segment);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(segment);
  }
  const polylines = [];
  for (const [key, group] of groups) {
    for (const polyline of chainGroup(group, pointKey)) {
      polylines.push({
        ...polyline,
        groupKey: key,
        height: group[0]?.height,
        tile: group[0]?.tile
      });
    }
  }
  return polylines;
}

export function flattenPolylinesToSegments(polylines) {
  const segments = [];
  for (const polyline of polylines) {
    const { points, closed, height, tile } = polyline;
    for (let index = 0; index < points.length - 1; index += 1) {
      segments.push({ start: points[index], end: points[index + 1], height, tile });
    }
    if (closed && points.length >= 2) {
      segments.push({ start: points.at(-1), end: points[0], height, tile });
    }
  }
  return segments;
}
