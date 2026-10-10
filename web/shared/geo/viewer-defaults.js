/**
 * Viewer 共通の初期位置・平面直角系（pre-dev-agreement: 小数点以下 3 桁）。
 * kuwaya-geo の INITIAL_LOCATION は参照実装の東京既定のため、本リポジトリではこちらを使う。
 */
export const VIEWER_LOCATIONS = Object.freeze({
  kyotoStation: Object.freeze({ latitude: 34.986, longitude: 135.759, label: '京都駅' }),
  tokyoStation: Object.freeze({ latitude: 35.681, longitude: 139.767, label: '東京駅' })
});

/** 初期表示は京都駅。東京は索引 PoC 確認用に切り替え可能。 */
export const DEFAULT_VIEWER_LOCATION = VIEWER_LOCATIONS.kyotoStation;

/** 日本平面直角座標系の系番号（ちずうつし / kuwaya-geo の zone と同じ） */
export const JPRC_ZONE = Object.freeze({
  kyoto: 6,
  tokyo: 9
});

export const DEFAULT_JPRC_ZONE = JPRC_ZONE.kyoto;
