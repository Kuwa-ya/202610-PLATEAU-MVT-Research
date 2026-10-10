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

import type { GeoFix } from '../geo/geo-fix.js';
import { formatFixShort } from '../geo/geo-fix.js';
import type { FrameSample } from '../metrics/frame-metrics.js';
import type { PresentDetail } from '../view/view-presenter.js';
import { getViewCameraStatusLine } from '../view/view-camera-state.js';

export function formatG2StatusMeta(fix: GeoFix, detail: PresentDetail): string {
  const fetchTag = detail.dataFetched ? 'DL' : '描画';
  const move =
    detail.movementBearingDeg != null
      ? `移動 ${Math.round(detail.movementBearingDeg)}°`
      : '北上固定';
  const lines = [
    formatFixShort(fix),
    `${move} · ${fetchTag}`,
    `面 ${detail.ringCount} · ${detail.meshCode}`
  ];
  if (detail.useDistrictSummary) {
    lines.push(detail.useDistrictSummary);
  } else if (detail.useDistrictMiss) {
    lines.push(detail.useDistrictHint ?? '用途地域: 該当なし');
  }
  return lines.join('\n');
}

export function formatG2StatusPerf(sample: FrameSample, sdkResult: string): string {
  const kb = sample.bytes < 1024 ? `${sample.bytes}B` : `${(sample.bytes / 1024).toFixed(1)}K`;
  const cam = getViewCameraStatusLine().replace('カメラ: ', '');
  const hint = sdkResult === 'success' ? '' : `\n${sdkResult}`;
  return [
    cam,
    `送信 ${Math.round(sample.totalMs)}ms · ${kb}`,
    `SDK ${Math.round(sample.sdkMs)}ms${hint}`
  ].join('\n');
}
