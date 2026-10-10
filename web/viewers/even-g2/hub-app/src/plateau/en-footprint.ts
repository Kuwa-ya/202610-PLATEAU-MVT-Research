const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 111_320;

/** ユーザー位置基準の東北座標（m）— WebGL 建物メッシュと同じ */
export function lonLatToEnMeters(
  lon: number,
  lat: number,
  userLon: number,
  userLat: number,
  pivotLat: number
): { east: number; north: number } {
  const cosLat = Math.cos(pivotLat * DEG_TO_RAD);
  return {
    east: (lon - userLon) * METERS_PER_DEG_LAT * cosLat,
    north: (lat - userLat) * METERS_PER_DEG_LAT
  };
}

/** 建物 footprint と同じ: shape (east,north) → rotateX(π/2) 後の地上点 */
export function enToGroundVector3(east: number, north: number, heightM = 0.45): {
  x: number;
  y: number;
  z: number;
} {
  return { x: east, y: heightM, z: north };
}
