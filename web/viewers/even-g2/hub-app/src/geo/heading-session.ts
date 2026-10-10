import { compassNeedsPermissionPrompt, isDeviceOrientationSupported } from './device-orientation.js';

type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export class HeadingSession {
  private deviceHeadingDeg: number | null = null;
  private manualOffsetDeg = 0;
  private permission: PermissionState = 'unknown';
  private listening = false;

  getPermissionState(): PermissionState {
    return this.permission;
  }

  /** 0 = 北、時計回り（度） */
  getHeadingDeg(): number {
    const base = this.deviceHeadingDeg ?? 0;
    const total = base + this.manualOffsetDeg;
    return ((total % 360) + 360) % 360;
  }

  nudgeManual(deltaDeg: number) {
    this.manualOffsetDeg += deltaDeg;
  }

  resetManual() {
    this.manualOffsetDeg = 0;
  }

  /** コンパスは QR 起動時は呼ばない。`requestPermission` または明示的な `start()` のみ */
  start() {
    if (typeof window === 'undefined') return;
    if (!isDeviceOrientationSupported()) {
      this.permission = 'unsupported';
      return;
    }
    this.attachListener();
  }

  stop() {
    if (!this.listening) return;
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('deviceorientationabsolute', this.onOrientation);
    this.listening = false;
  }

  /** iOS 13+ はユーザージェスチャーが必要 */
  async requestPermission(): Promise<PermissionState> {
    if (!isDeviceOrientationSupported()) {
      this.permission = 'unsupported';
      return this.permission;
    }
    const request = compassNeedsPermissionPrompt()
      ? (globalThis as typeof globalThis & {
          DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
        }).DeviceOrientationEvent?.requestPermission
      : undefined;
    if (typeof request !== 'function') {
      this.permission = 'granted';
      this.attachListener();
      return this.permission;
    }
    try {
      const result = await request();
      this.permission = result === 'granted' ? 'granted' : 'denied';
      if (this.permission === 'granted') this.attachListener();
      return this.permission;
    } catch {
      this.permission = 'denied';
      return this.permission;
    }
  }

  applyFromGeolocation(headingDeg: number | null | undefined) {
    if (headingDeg == null || !Number.isFinite(headingDeg) || headingDeg < 0) return;
    this.deviceHeadingDeg = headingDeg;
  }

  private attachListener() {
    if (this.listening) return;
    window.addEventListener('deviceorientation', this.onOrientation, true);
    this.listening = true;
    if (this.permission === 'unknown') this.permission = 'granted';
  }

  private onOrientation = (event: DeviceOrientationEvent) => {
    const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (Number.isFinite(webkit)) {
      this.deviceHeadingDeg = webkit as number;
      return;
    }
    if (event.alpha == null || !Number.isFinite(event.alpha)) return;
    const alpha = event.alpha;
    if (event.absolute) {
      this.deviceHeadingDeg = ((360 - alpha) % 360 + 360) % 360;
    }
  };
}
