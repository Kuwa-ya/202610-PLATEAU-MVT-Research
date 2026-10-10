/**
 * ちずうつし Three ビューワ（`docs/ref/kuwaya-geo/js/view/camera.js`）と同型の球面カメラ。
 * 方位 theta は固定（南側）。距離 radius と俯角 phi（＝地面からの仰角）のみ変更。
 */

const DEG_TO_RAD = Math.PI / 180;

/** 地面からの仰角（度）— kuwaya `CAMERA_MIN_ANGLE`〜`CAMERA_MAX_ANGLE` 相当 */
const MIN_ELEVATION_DEG = 5;
const MAX_ELEVATION_DEG = 80;

/** ユーザー中心からの距離（m）— 既定をやや遠め */
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 520;
const DEFAULT_RADIUS_M = 280;
const DEFAULT_ELEVATION_DEG = 38;

/** 南側（-Z）からユーザー原点を見る。画面上奥＝+Z（北） */
export const CAMERA_AZIMUTH_THETA = Math.PI;

const state = {
  radiusM: DEFAULT_RADIUS_M,
  elevationDeg: DEFAULT_ELEVATION_DEG
};

export function getViewCameraSpherical(): { radius: number; phi: number; theta: number } {
  const elevationRad = state.elevationDeg * DEG_TO_RAD;
  const phi = Math.max(0.001, Math.PI / 2 - elevationRad);
  return { radius: state.radiusM, phi, theta: CAMERA_AZIMUTH_THETA };
}

export function getViewCameraStatusLine(): string {
  return `カメラ: 距離 ${Math.round(state.radiusM)} m · 仰角 ${state.elevationDeg.toFixed(0)}°`;
}

/** Even 上スワイプ（SCROLL_TOP）— より水平に（仰角を下げる） */
export function nudgeCameraElevationUpDeg(deltaDeg = 4) {
  state.elevationDeg = Math.min(MAX_ELEVATION_DEG, state.elevationDeg - deltaDeg);
}

/** Even 下スワイプ（SCROLL_BOTTOM）— より俯瞰（仰角を上げる） */
export function nudgeCameraElevationDownDeg(deltaDeg = 4) {
  state.elevationDeg = Math.max(MIN_ELEVATION_DEG, state.elevationDeg + deltaDeg);
}

export function resetViewCamera() {
  state.radiusM = DEFAULT_RADIUS_M;
  state.elevationDeg = DEFAULT_ELEVATION_DEG;
}
