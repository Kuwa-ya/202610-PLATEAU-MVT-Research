/*!
 * 住所ジオコード結果 → カメラ／地形（docs/ref/kuwaya-geo/js/app.js の goToAddressSearch 同型）
 */

import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE
} from '/kuwaya-geo/js/config.js';
import { toLocalPosition } from '/kuwaya-geo/js/foundation/local-frame.js';

/** この距離を超えたら terrain.request で原点を載せ替える（タイル圏外パンを避ける） */
const ORIGIN_REBUILD_DISTANCE_M = 8_000;

function approxDistanceM(lat1, lon1, lat2, lon2) {
  const midLat = ((lat1 + lat2) * 0.5 * Math.PI) / 180;
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lon2 - lon1) * 111_320 * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

export function applyGeocodeResult(ctx) {
  const {
    THREE,
    result,
    terrain,
    focusedTarget,
    focusedSpherical,
    requestTerrainAt,
    applyFocusElevation,
    scheduleStream,
    scheduleLodRefresh,
    mvtMaxCameraDistance
  } = ctx;

  const radiusCap = Math.min(CAMERA_MAX_DISTANCE, mvtMaxCameraDistance * 0.85);
  focusedSpherical.radius = THREE.MathUtils.clamp(
    result.cameraDistance,
    CAMERA_MIN_DISTANCE,
    radiusCap
  );

  const currentOrigin = terrain.getOrigin();
  let originRebuilt = false;

  if (!currentOrigin) {
    requestTerrainAt(result.latitude, result.longitude, true);
    originRebuilt = true;
  } else {
    const dist = approxDistanceM(
      currentOrigin.latitude,
      currentOrigin.longitude,
      result.latitude,
      result.longitude
    );
    if (dist > ORIGIN_REBUILD_DISTANCE_M) {
      requestTerrainAt(result.latitude, result.longitude, true);
      originRebuilt = true;
    } else {
      const local = toLocalPosition(
        result.latitude,
        result.longitude,
        0,
        currentOrigin,
        terrain.getZone(),
        1
      );
      focusedTarget.set(local.x, focusedTarget.y, local.z);
      applyFocusElevation();
    }
  }

  scheduleStream(80);
  scheduleLodRefresh();

  return { originRebuilt };
}

export function originRefFromTerrain(terrain) {
  const o = terrain?.getOrigin?.();
  if (!o) return null;
  return { lat: o.latitude, lon: o.longitude };
}
