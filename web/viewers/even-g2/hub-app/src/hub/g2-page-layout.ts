/** Even 眼キャンバス 576×288 — 左: 地図、右: テキスト 2 段 */

export const G2_CANVAS_W = 576;
export const G2_CANVAS_H = 288;

export const G2_IMG_W = 288;
export const G2_IMG_H = 144;

export const G2_IMAGE = {
  x: 0,
  y: Math.floor((G2_CANVAS_H - G2_IMG_H) / 2),
  width: G2_IMG_W,
  height: G2_IMG_H,
  containerID: 3,
  containerName: 'plateauFrame'
} as const;

const TEXT_X = G2_IMG_W + 6;
const TEXT_W = G2_CANVAS_W - TEXT_X;

export const G2_STATUS_META = {
  x: TEXT_X,
  y: 0,
  width: TEXT_W,
  height: Math.floor(G2_CANVAS_H / 2) - 2,
  containerID: 2,
  containerName: 'statusMeta'
} as const;

export const G2_STATUS_PERF = {
  x: TEXT_X,
  y: Math.floor(G2_CANVAS_H / 2) + 2,
  width: TEXT_W,
  height: Math.floor(G2_CANVAS_H / 2) - 2,
  containerID: 4,
  containerName: 'statusPerf'
} as const;

export const G2_EVENT_LAYER = {
  x: 0,
  y: 0,
  width: G2_CANVAS_W,
  height: G2_CANVAS_H,
  containerID: 1,
  containerName: 'eventLayer'
} as const;
