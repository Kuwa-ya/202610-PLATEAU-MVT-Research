/**
 * ちずうつし Three ビューワ（`docs/ref/kuwaya-geo/js/view/camera.js`）と同型の球面カメラ。
 * 方位 theta は固定（南側）。距離 radius と俯角 phi（＝地面からの仰角）のみ変更。
 */

const DEG_TO_RAD = Math.PI / 180;

/** 地面からの仰角（度） */
const MIN_ELEVATION_DEG = 15;
const MAX_ELEVATION_DEG = 90;

/** ユーザー中心からの距離（m）— 既定をやや遠め */
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 520;
const DEFAULT_RADIUS_M = 280;
const DEFAULT_ELEVATION_DEG = 60;

/**
 * 南側から見上げる固定カメラ（`theta = π`）。ローカルは X=東・Z=-北（`local-frame.js`）。
 * 建物グループの `scale.x = -1` で東西の鏡面を解消する。
 */
export const CAMERA_AZIMUTH_THETA = Math.PI;

const state = {
  radiusM: DEFAULT_RADIUS_M,
  elevationDeg: DEFAULT_ELEVATION_DEG
};

function clampElevationDeg(deg: number): number {
  return Math.min(MAX_ELEVATION_DEG, Math.max(MIN_ELEVATION_DEG, deg));
}

export function getViewCameraSpherical(): { radius: number; phi: number; theta: number } {
  const elevationRad = clampElevationDeg(state.elevationDeg) * DEG_TO_RAD;
  const phi = Math.max(0.001, Math.PI / 2 - elevationRad);
  return { radius: state.radiusM, phi, theta: CAMERA_AZIMUTH_THETA };
}

export function getViewCameraStatusLine(): string {
  return `カメラ: 距離 ${Math.round(state.radiusM)} m · 仰角 ${clampElevationDeg(state.elevationDeg).toFixed(0)}°`;
}

/** Even 上スワイプ（SCROLL_TOP）— より水平に（仰角を下げる） */
export function nudgeCameraElevationUpDeg(deltaDeg = 4) {
  state.elevationDeg = clampElevationDeg(state.elevationDeg - deltaDeg);
}

/** Even 下スワイプ（SCROLL_BOTTOM）— より俯瞰（仰角を上げる） */
export function nudgeCameraElevationDownDeg(deltaDeg = 4) {
  state.elevationDeg = clampElevationDeg(state.elevationDeg + deltaDeg);
}

export function resetViewCamera() {
  state.radiusM = DEFAULT_RADIUS_M;
  state.elevationDeg = DEFAULT_ELEVATION_DEG;
}
