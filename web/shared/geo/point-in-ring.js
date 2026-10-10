/**
 * 経緯度リングに対する点包含（MVT クリック照会の地面投影用）
 */

/** @param {[number, number][]} ring — [lon, lat] */
export function pointInRingLonLat(lon, lat, ring) {
  if (!ring?.length) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      (yi > lat) !== (yj > lat)
      && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * @param {[number, number][]} outer
 * @param {[number, number][][]} [holes]
 */
export function pointInPolygonLonLat(lon, lat, outer, holes = []) {
  if (!pointInRingLonLat(lon, lat, outer)) return false;
  for (const hole of holes) {
    if (hole?.length && pointInRingLonLat(lon, lat, hole)) return false;
  }
  return true;
}
