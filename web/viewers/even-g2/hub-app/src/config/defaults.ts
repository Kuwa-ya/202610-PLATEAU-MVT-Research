/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

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

/** B.1 地面メッシュ — Web Mercator タイルの基準ズーム */
export const GROUND_TILE_ZOOM = 17;

/** 再描画をスキップする最小移動（m） */
export const VIEW_MIN_MOVE_M = 0.5;

/** 移動方向矢印を出す最小移動（m） */
export const VIEW_MOVE_ARROW_MIN_M = 0.35;

/** メトリクス用: G2 フル更新の最小間隔 */
export const GPS_MIN_INTERVAL_MS = 500;

/** メッシュ内の移動のみのときの参考（データ取得はメッシュキーで判定） */
export const GPS_MIN_MOVE_M = 10;
