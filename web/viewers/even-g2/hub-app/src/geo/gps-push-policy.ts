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

import { GPS_MIN_INTERVAL_MS, GPS_MIN_MOVE_M } from '../config/defaults.js';
import type { GeoFix } from './geo-fix.js';
import { haversineMeters } from './haversine.js';

export type PushDecision = {
  shouldPush: boolean;
  reason: string;
  moveM: number | null;
};

export class GpsPushPolicy {
  private lastPushAt = 0;
  /** 画像を最後に送った位置（初回 fix は基準点のみ・再送なし） */
  private anchorFix: GeoFix | null = null;

  evaluate(fix: GeoFix, now = performance.now()): PushDecision {
    if (!this.anchorFix) {
      return { shouldPush: false, reason: 'GPS 基準点（移動で再送）', moveM: null };
    }

    const elapsed = now - this.lastPushAt;
    if (elapsed < GPS_MIN_INTERVAL_MS) {
      return {
        shouldPush: false,
        reason: `間引き ${Math.round(GPS_MIN_INTERVAL_MS - elapsed)}ms`,
        moveM: haversineMeters(
          this.anchorFix.latitude,
          this.anchorFix.longitude,
          fix.latitude,
          fix.longitude
        )
      };
    }

    const moveM = haversineMeters(
      this.anchorFix.latitude,
      this.anchorFix.longitude,
      fix.latitude,
      fix.longitude
    );
    if (moveM < GPS_MIN_MOVE_M) {
      return { shouldPush: false, reason: `移動 ${moveM.toFixed(1)}m < ${GPS_MIN_MOVE_M}m`, moveM };
    }

    return { shouldPush: true, reason: `移動 ${moveM.toFixed(0)}m`, moveM };
  }

  noteFix(fix: GeoFix) {
    if (!this.anchorFix) this.anchorFix = fix;
  }

  markPushed(fix: GeoFix, now = performance.now()) {
    this.lastPushAt = now;
    this.anchorFix = fix;
  }
}
