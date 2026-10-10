import { FALLBACK_LOCATION } from '../config/defaults.js';
import type { GeoFix } from './geo-fix.js';
import type { WatchPositionOptions } from './watch-position.js';

export type ManualGeoControls = {
  nudgeMeters: (northM: number, eastM: number) => void;
  resetToFallback: () => void;
};

let controls: ManualGeoControls | null = null;

export function getManualGeoControls(): ManualGeoControls | null {
  return controls;
}

function metersToDelta(lat: number, northM: number, eastM: number) {
  const dLat = northM / 111_320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLon = eastM / (111_320 * Math.max(0.2, Math.abs(cosLat)));
  return { dLat, dLon };
}

/** HTTP 実機向け: 手動で座標を動かし、GPS 再送ポリシーを検証する */
export function watchManualPosition(options: WatchPositionOptions): () => void {
  let lat = FALLBACK_LOCATION.latitude;
  let lon = FALLBACK_LOCATION.longitude;

  const emit = () => {
    options.onFix({
      latitude: lat,
      longitude: lon,
      accuracyM: 8,
      at: new Date().toISOString()
    });
    options.onStatus?.('手動 GPS（HTTP・実機向け）');
  };

  const api: ManualGeoControls = {
    nudgeMeters(northM, eastM) {
      const { dLat, dLon } = metersToDelta(lat, northM, eastM);
      lat += dLat;
      lon += dLon;
      emit();
    },
    resetToFallback() {
      lat = FALLBACK_LOCATION.latitude;
      lon = FALLBACK_LOCATION.longitude;
      emit();
    }
  };

  controls = api;
  options.onStatus?.(
    'HTTP のため端末 GPS 不可。下のボタンで 15m 移動をシミュレート（シミュレータは localhost で本物 GPS 可）'
  );
  emit();

  return () => {
    if (controls === api) controls = null;
  };
}

export function secureContextLabel(): string {
  return window.isSecureContext
    ? `Secure Context: はい (${location.protocol}//${location.host})`
    : `Secure Context: いいえ (${location.protocol}//${location.host}) — 実機 HTTP`;
}
