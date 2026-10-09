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

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = value => Math.hypot(...value);
const normalize = value => { const size = length(value); return value.map(item => item / size); };
const dot = (a, b) => a.reduce((sum, item, index) => sum + item * b[index], 0);
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function isCounterClockwise(ring) {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) > 0;
}
export const reverseRing = ring => [...ring].reverse();
export function isRingClosed(ring) {
  if (ring.length < 2 || ring[0].length !== ring.at(-1).length) return false;
  return ring[0].every((value, index) => value === ring.at(-1)[index]);
}
export const closeRing = ring => isRingClosed(ring) ? ring : [...ring, [...ring[0]]];
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segmentsIntersect = (a, b, c, d) => Math.sign(cross2(a, b, c)) * Math.sign(cross2(a, b, d)) < 0
  && Math.sign(cross2(c, d, a)) * Math.sign(cross2(c, d, b)) < 0;
export function isSelfIntersecting(ring) {
  for (let i = 0; i < ring.length - 1; i += 1) for (let j = i + 1; j < ring.length - 1; j += 1) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === ring.length - 2)) continue;
    if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
  }
  return false;
}
export function distancePointToSegment(point, a, b) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  dx = point[0] - (a[0] + t * dx); dy = point[1] - (a[1] + t * dy);
  return Math.hypot(dx, dy);
}
export function isPointInPolygon(point, polygon, epsilon = 1e-10) {
  let angle = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (distancePointToSegment(point, a, b) < epsilon) return true;
    const ax = a[0] - point[0], ay = a[1] - point[1], bx = b[0] - point[0], by = b[1] - point[1];
    angle += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  }
  return Math.abs(angle) > Math.PI;
}
export const distance = (a, b) => length(subtract(a, b));
export function getAngle360(a, b, c, normal) {
  const first = normalize(subtract(a, b)), second = normalize(subtract(c, b));
  let angle = Math.acos(Math.max(-1, Math.min(1, dot(first, second)))) * 180 / Math.PI;
  if (dot(cross3(first, second), normal) < 0) angle = 360 - angle;
  return angle;
}
export function projectPolygonOntoPlane3D(polygon, origin, normal) {
  const n = normalize(normal);
  return polygon.map(point => { const height = dot(subtract(point, origin), n); return point.map((value, index) => value - height * n[index]); });
}
export const getTriangleCentroid = (a, b, c) => a.map((value, index) => (value + b[index] + c[index]) / 3);
