import type { GeoFix } from './geo-fix.js';
import { watchManualPosition } from './manual-geo-dev.js';

export type WatchPositionOptions = {
  onFix: (fix: GeoFix) => void;
  onStatus?: (message: string) => void;
  enableHighAccuracy?: boolean;
  maximumAgeMs?: number;
  timeoutMs?: number;
};

export function watchPosition(options: WatchPositionOptions): () => void {
  const geo = navigator.geolocation;

  if (!window.isSecureContext) {
    return watchManualPosition(options);
  }

  if (!geo) {
    options.onStatus?.('Geolocation API が利用できません');
    return watchManualPosition(options);
  }

  options.onStatus?.('GPS 待機中…（Even アプリの位置情報も「許可」にしてください）');

  const watchId = geo.watchPosition(
    position => {
      const heading = position.coords.heading;
      const headingDeg =
        heading != null && Number.isFinite(heading) && heading >= 0 ? heading : null;
      options.onFix({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        headingDeg,
        at: new Date(position.timestamp).toISOString()
      });
      options.onStatus?.('GPS 受信中（端末）');
    },
    error => {
      const message = geolocationErrorMessage(error);
      options.onStatus?.(message);
      console.warn('[gps]', error);
    },
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: options.maximumAgeMs ?? 2000,
      timeout: options.timeoutMs ?? 15_000
    }
  );

  return () => geo.clearWatch(watchId);
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'GPS 拒否 — OS で Even アプリの位置情報を許可してください';
    case error.POSITION_UNAVAILABLE:
      return 'GPS 取得不可 — 屋外・電波を確認';
    case error.TIMEOUT:
      return 'GPS タイムアウト — 再試行中';
    default:
      return `GPS エラー: ${error.message}`;
  }
}
