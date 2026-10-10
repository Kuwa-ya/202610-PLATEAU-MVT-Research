import type { GeoFix } from './geo-fix.js';
import { formatFixShort } from './geo-fix.js';
import { GpsPushPolicy } from './gps-push-policy.js';
import { secureContextLabel } from './manual-geo-dev.js';
import { watchPosition } from './watch-position.js';

export class GpsSession {
  private latest: GeoFix | null = null;
  private status = '未開始';
  private gpsPushCount = 0;
  private skippedCount = 0;
  private lastDecision = '';
  private readonly policy = new GpsPushPolicy();
  private stopWatch = () => {};

  start(
    onPush: (fix: GeoFix, reason: string) => void,
    onTick?: () => void
  ) {
    this.stopWatch = watchPosition({
      onStatus: message => {
        this.status = message;
        onTick?.();
      },
      onFix: fix => {
        this.latest = fix;
        const decision = this.policy.evaluate(fix);
        this.lastDecision = decision.reason;
        if (!decision.shouldPush) {
          this.policy.noteFix(fix);
          this.skippedCount += 1;
          onTick?.();
          return;
        }
        this.policy.markPushed(fix);
        this.gpsPushCount += 1;
        onPush(fix, decision.reason);
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
      `GPS 再送: ${this.gpsPushCount} 回 / スキップ: ${this.skippedCount} 回`,
      this.lastDecision ? `直近判定: ${this.lastDecision}` : ''
    ];
    return lines.filter(Boolean).join('\n');
  }
}
