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
