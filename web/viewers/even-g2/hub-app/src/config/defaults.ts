/** 京都駅（リポジトリ `web/shared/geo/viewer-defaults.js` と同値） */
export const FALLBACK_LOCATION = Object.freeze({
  latitude: 34.986,
  longitude: 135.759,
  label: '京都駅'
});

/** 画面更新ポーリング（描画のみ。GeoJSON はメッシュ切替時のみ） */
export const VIEW_REFRESH_MS = 500;

/** G2 建物フレーム: `webgl`（Three.js）| `canvas2d`（従来の Canvas 2D） */
export const VIEW_RENDER_BACKEND: 'webgl' | 'canvas2d' = 'webgl';

/** 再描画をスキップする最小移動（m） */
export const VIEW_MIN_MOVE_M = 0.5;

/** 移動方向矢印を出す最小移動（m） */
export const VIEW_MOVE_ARROW_MIN_M = 0.35;

/** メトリクス用: G2 フル更新の最小間隔 */
export const GPS_MIN_INTERVAL_MS = 500;

/** メッシュ内の移動のみのときの参考（データ取得はメッシュキーで判定） */
export const GPS_MIN_MOVE_M = 10;
