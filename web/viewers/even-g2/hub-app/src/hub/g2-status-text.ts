/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import type { GeoFix } from '../geo/geo-fix.js';
import { formatCoord } from '../geo/geo-fix.js';
import type { AddressSessionState } from '../geo/address-session.js';
import { bearing16LabelFromDeg } from '../geo/bearing-16.js';
import type { FrameSample } from '../metrics/frame-metrics.js';
import type { PresentDetail } from '../view/view-presenter.js';
import { getViewCameraStatusLine } from '../view/view-camera-state.js';

let lastBearing16 = '—';

export function formatG2StatusMeta(
  fix: GeoFix,
  address: AddressSessionState,
  detail: PresentDetail
): string {
  if (detail.movementBearingDeg != null) {
    lastBearing16 = bearing16LabelFromDeg(detail.movementBearingDeg);
  }
  const elev =
    address.elevationM != null ? `標高 ${address.elevationM.toFixed(1)}m` : '標高 —';
  const coord = `${formatCoord(fix.latitude, 5)}, ${formatCoord(fix.longitude, 5)}`;
  const bearing = `方角 ${lastBearing16}`;
  let addr = '住所 取得中…';
  if (!address.addressPending) {
    addr = address.addressLabel ? `住所 ${address.addressLabel}` : '住所 —';
  }

  const lines = [elev, coord, bearing, addr];
  if (detail.useDistrictSummary) {
    lines.push(detail.useDistrictSummary);
  } else if (detail.useDistrictMiss) {
    lines.push(detail.useDistrictHint ?? '用途地域: 該当なし');
  }
  return lines.join('\n');
}

/** モバイル側デバッグ用（G2 には送らない） */
export function formatPhoneDebugBlock(
  sample: FrameSample,
  detail: PresentDetail,
  sdkResult: string
): string {
  const kb = sample.bytes < 1024 ? `${sample.bytes}B` : `${(sample.bytes / 1024).toFixed(1)}K`;
  const cam = getViewCameraStatusLine();
  const fetchTag = detail.dataFetched ? 'DL' : '描画';
  const move =
    detail.movementBearingDeg != null
      ? `移動 ${Math.round(detail.movementBearingDeg)}°`
      : '北上固定';
  const hint = sdkResult === 'success' ? '' : `\nSDK: ${sdkResult}`;
  return [
    `面 ${detail.ringCount} · ${detail.meshCode}`,
    `${move} · ${fetchTag}`,
    cam,
    `送信 ${Math.round(sample.totalMs)}ms · ${kb} · SDK ${Math.round(sample.sdkMs)}ms${hint}`
  ].join('\n');
}

/** @deprecated G2 では使用しない — 互換のため残す */
export function formatG2StatusPerf(sample: FrameSample, sdkResult: string): string {
  void sample;
  void sdkResult;
  return ' ';
}
