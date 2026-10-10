/**
 * MVT / GeoJSON ポリゴンのリング列を外周＋穴のグループに分割する。
 * Mapbox geojson-vt の classifyRings と同方針（符号付き面積で外周を判定）。
 */

export function signedAreaRing(ring) {
  if (!ring?.length) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * @param {Array<Array<{x:number,y:number}>>} rings loadGeometry() の結果（type 3）
 * @returns {Array<Array<Array<{x:number,y:number}>>>} 各要素 [外周, ...穴]
 */
export function classifyPolygonRings(rings) {
  const list = Array.isArray(rings) ? rings.filter(r => r?.length >= 3) : [];
  if (list.length <= 1) return list.length ? [list] : [];

  const polygons = [];
  let polygon = [];
  const ccw = signedAreaRing(list[0]) < 0;

  for (const ring of list) {
    const area = signedAreaRing(ring);
    if (area === 0) continue;
    if (polygon.length === 0) {
      polygon.push(ring);
    } else if ((area < 0) === ccw) {
      polygons.push(polygon);
      polygon = [ring];
    } else {
      polygon.push(ring);
    }
  }
  if (polygon.length) polygons.push(polygon);
  return polygons;
}
