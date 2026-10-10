/*!
 * Even G2 斜視図 — 緑系モノクロ（実機 PNG / WebGL 正本）
 * 段階: 現在地 ＞ 道路 ＞ 建物
 */

export const G2_VISUAL = {
  sceneBackground: 0x030806,

  /** 建物本体 — 道路より一段暗い緑グレー（現在地 ＞ 道路 ＞ 建物） */
  buildingColor: 0x5a8268,
  buildingOpacity: 0.72,
  buildingEmissive: 0x0a1810,
  buildingEmissiveIntensity: 0.1,

  roadColor: 0xa8d4b8,
  roadOpacity: 0.9,

  userMarkerRingColor: 0x7affaa,
  userMarkerRingOpacity: 0.96,
  userMarkerPoleColor: 0x9affb8,
  userMarkerDotColor: 0xc8ffe0,
  userMarkerArrowColor: 0xe8ff9a,

  useDistrictLineColor: 0x66d890,
  useDistrictLineOpacity: 0.94,

  /** 緑系ライト（フラット感を減らしコントラスト UP） */
  lightAmbientColor: 0xb8dcc8,
  lightAmbientIntensity: 0.38,
  lightSunColor: 0xe8fff0,
  lightSunIntensity: 1.05
} as const;

/** Canvas 2D フォールバック — WebGL と同系統 */
export const G2_CANVAS2D = {
  roofFill: 'rgba(90, 130, 104, 0.65)',
  wallRgbBase: [82, 118, 96] as const
} as const;
