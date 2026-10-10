/** 京都駅（リポジトリ `web/shared/geo/viewer-defaults.js` と同値） */
export const FALLBACK_LOCATION = Object.freeze({
  latitude: 34.986,
  longitude: 135.759,
  label: '京都駅'
});

/** 画面更新ポーリング（描画のみ。GeoJSON はメッシュ切替時のみ） */
export const VIEW_REFRESH_MS = 750;

/** 再描画をスキップする最小移動（m） */
export const VIEW_MIN_MOVE_M = 0.5;

/** 再描画をスキップする最小方位変化（度） */
export const VIEW_MIN_HEADING_DEG = 2;

/** メトリクス用: G2 フル更新の最小間隔 */
export const GPS_MIN_INTERVAL_MS = 500;

/** メッシュ内の移動のみのときの参考（データ取得はメッシュキーで判定） */
export const GPS_MIN_MOVE_M = 10;
