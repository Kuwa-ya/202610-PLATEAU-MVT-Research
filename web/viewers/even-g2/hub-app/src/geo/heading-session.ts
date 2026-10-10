/** 向き（手動 ±15° ＋ GPS 進行方位があれば合成）。0=北、時計回り（度） */
export class HeadingSession {
  private courseHeadingDeg: number | null = null;
  private manualOffsetDeg = 0;
  private readonly onChangeListeners: Array<() => void> = [];
  private lastNotifyMs = 0;

  getHeadingDeg(): number {
    const base = this.courseHeadingDeg ?? 0;
    const total = base + this.manualOffsetDeg;
    return ((total % 360) + 360) % 360;
  }

  formatHeadingStatus(): string {
    const parts = [`手動オフセット: ${this.manualOffsetDeg.toFixed(0)}°`];
    if (this.courseHeadingDeg != null) {
      parts.push(`GPS 進行方位: ${this.courseHeadingDeg.toFixed(0)}°`);
    }
    return `向き: ${parts.join(' · ')}`;
  }

  onHeadingChange(listener: () => void) {
    this.onChangeListeners.push(listener);
  }

  nudgeManual(deltaDeg: number) {
    this.manualOffsetDeg += deltaDeg;
    this.notifyChangeThrottled();
  }

  resetManual() {
    this.manualOffsetDeg = 0;
    this.notifyChangeThrottled();
  }

  applyFromGeolocation(headingDeg: number | null | undefined) {
    if (headingDeg == null || !Number.isFinite(headingDeg) || headingDeg < 0) return;
    this.courseHeadingDeg = headingDeg;
    this.notifyChangeThrottled();
  }

  stop() {
    // センサー購読なし（手動・GPS のみ）
  }

  private notifyChangeThrottled() {
    const now = performance.now();
    if (now - this.lastNotifyMs < 80) return;
    this.lastNotifyMs = now;
    for (const listener of this.onChangeListeners) listener();
  }
}
