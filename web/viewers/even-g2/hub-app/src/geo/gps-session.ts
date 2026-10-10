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

import type { GeoFix } from './geo-fix.js';
import { formatFixShort } from './geo-fix.js';
import { secureContextLabel } from './manual-geo-dev.js';
import { watchPosition } from './watch-position.js';

export class GpsSession {
  private latest: GeoFix | null = null;
  private status = '未開始';
  private fixCount = 0;
  private stopWatch = () => {};

  start(onFix: (fix: GeoFix) => void, onTick?: () => void) {
    this.stopWatch = watchPosition({
      onStatus: message => {
        this.status = message;
        onTick?.();
      },
      onFix: fix => {
        this.latest = fix;
        this.fixCount += 1;
        onFix(fix);
        onTick?.();
      }
    });
  }

  getLatestFix(): GeoFix | null {
    return this.latest;
  }

  stop() {
    this.stopWatch();
    this.stopWatch = () => {};
  }

  formatReport(): string {
    const lines = [
      '検証 4 — GPS',
      secureContextLabel(),
      `状態: ${this.status}`,
      this.latest
        ? `現在地: ${formatFixShort(this.latest)} (±${this.latest.accuracyM?.toFixed(0) ?? '?'} m)`
        : '現在地: —',
      `GPS 更新: ${this.fixCount} 回`
    ];
    return lines.filter(Boolean).join('\n');
  }
}
