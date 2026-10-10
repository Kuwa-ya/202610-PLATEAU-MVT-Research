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
      this.latest?.headingDeg != null && Number.isFinite(this.latest.headingDeg)
        ? `進行方位: ${this.latest.headingDeg.toFixed(0)}°`
        : '',
      `GPS 更新: ${this.fixCount} 回`
    ];
    return lines.filter(Boolean).join('\n');
  }
}
