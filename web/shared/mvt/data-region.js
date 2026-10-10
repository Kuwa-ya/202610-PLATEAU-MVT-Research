/*!
 * PLATEAU MVT Research — JavaScript source module
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

/**
 * 実行時データは `web/data/`（配信時は `/data/...`）。
 * MVT 索引・manifest は `npm run build:mvt-index` で生成（Git では ignore）。
 *
 * Even G2 .ehpk は `base: './'` でビルドし、`index.html` 同階層の `data/mvt/` を参照する。
 * MapLibre 等（サイトルート配信）は従来どおり `/data/mvt`。
 */
let cachedMvtDataBase;

export function getMvtDataBase() {
  if (cachedMvtDataBase) return cachedMvtDataBase;
  if (typeof process !== 'undefined' && process.env?.MVT_DATA_BASE) {
    cachedMvtDataBase = process.env.MVT_DATA_BASE.replace(/\/$/, '');
    return cachedMvtDataBase;
  }
  const viteBase =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL;
  if (viteBase === './' && typeof document !== 'undefined' && document.baseURI) {
    cachedMvtDataBase = new URL('data/mvt/', document.baseURI).href.replace(/\/$/, '');
    return cachedMvtDataBase;
  }
  cachedMvtDataBase = '/data/mvt';
  return cachedMvtDataBase;
}

/** @deprecated 取得は {@link getMvtDataBase} を使う（G2 パックでは相対 URL） */
export const DATA_BASE = '/data/mvt';

export const BOUNDARY_LAYERS = Object.freeze([
  Object.freeze({
    id: 'kyoto',
    label: '京都府',
    url: '/data/boundaries/kyoto-cities.geojson',
    boundaryColor: '#7c3aed',
    dasharray: [2, 2]
  }),
  Object.freeze({
    id: 'kanto',
    label: '関東（東京・埼玉）',
    url: '/data/boundaries/kanto-cities.geojson',
    boundaryColor: '#f43f5e',
    dasharray: [3, 1.5]
  })
]);
