/**
 * 住所マッチ粒度 → MapLibre ズーム（2D flyTo 用）
 */

/** @param {string | null | undefined} matchDepth @param {number} [mvtMinZoom] */
export function mapZoomForAddressMatch(matchDepth, mvtMinZoom = 16) {
  switch (matchDepth) {
    case 'pref':
      return Math.max(mvtMinZoom - 6, 5);
    case 'city':
      return Math.max(mvtMinZoom - 4, 8);
    case 'oaza_cho':
      return mvtMinZoom - 1.5;
    case 'chome':
      return mvtMinZoom + 0.2;
    case 'blk_num':
      return mvtMinZoom + 1;
    case 'rsdt_num':
      return mvtMinZoom + 1.5;
    default:
      return mvtMinZoom + 0.2;
  }
}
