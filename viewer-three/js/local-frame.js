const METERS_PER_DEG_LAT = 111_320;

export function metersPerDegreeLon(latitude) {
  return METERS_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
}

/** ローカル XZ（ちずうつし座標）→ 緯度経度 */
export function latLonFromLocal(origin, localX, localZ) {
  const mLon = metersPerDegreeLon(origin.lat);
  return {
    lat: origin.lat - localZ / METERS_PER_DEG_LAT,
    lon: origin.lon + localX / mLon
  };
}

export function viewCenterFromTarget(origin, target) {
  return latLonFromLocal(origin, target.x, target.z);
}
