/** 京都駅（リポジトリ `web/shared/geo/viewer-defaults.js` と同値） */
export const FALLBACK_LOCATION = Object.freeze({
  latitude: 34.986,
  longitude: 135.759,
  label: '京都駅'
});

/** 検証 3 ベースライン（SDK ~300–400 ms）を踏まえた最小間隔 */
export const GPS_MIN_INTERVAL_MS = 500;

/** これ未満の移動では画像再送しない（方位のみの更新は別途検証 5） */
export const GPS_MIN_MOVE_M = 10;
