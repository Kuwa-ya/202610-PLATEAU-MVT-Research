/** 外環 [lon, lat] に対する点包含（ray casting） */

export function pointInRingLonLat(lon, lat, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 建物外環のいずれかの頂点、または重心が区域内なら true */
export function footprintIntersectsRingLonLat(outerRing, districtRing) {
  if (!districtRing?.length || !outerRing?.length) return false;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of outerRing) {
    if (pointInRingLonLat(lon, lat, districtRing)) return true;
    sumLon += lon;
    sumLat += lat;
  }
  const n = outerRing.length;
  return pointInRingLonLat(sumLon / n, sumLat / n, districtRing);
}
