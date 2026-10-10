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
