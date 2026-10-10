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
  return [
    formatFixShort(fix),
    `${move} · ${fetchTag}`,
    `面 ${detail.ringCount} · ${detail.meshCode}`
  ].join('\n');
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
