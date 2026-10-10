/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { VIEW_REFRESH_MS } from './config/defaults.js';
import type { GpsSession } from './geo/gps-session.js';
import { getManualGeoControls } from './geo/manual-geo-dev.js';
import type { FrameMetrics } from './metrics/frame-metrics.js';
import { getPhonePreviewUrl, subscribePhonePreview } from './preview/phone-preview.js';

export type PhonePanelHubInfo = {
  hubMode: 'simulation' | 'even';
  hubDetail?: string;
};

export function mountPhonePanel(
  metrics: FrameMetrics,
  gps: GpsSession,
  getDebugBlock: () => string,
  onViewRefresh: () => void,
  hub: PhonePanelHubInfo = { hubMode: 'simulation' },
  onPreviewTap?: () => void
) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  const showManual = !window.isSecureContext;

  root.innerHTML = `
    <div class="g2-phone-root">
      <figure class="g2-phone-preview-wrap">
        <img id="g2-phone-preview" class="g2-phone-preview" alt="G2 プレビュー" width="576" height="288" />
        <figcaption class="g2-phone-preview-cap">G2 プレビュー（タップで用途地域 ON/OFF）</figcaption>
      </figure>
      <p id="hub-mode-banner" class="g2-phone-banner"></p>
      ${
        showManual
          ? `<div id="manual-geo" class="g2-phone-manual">
        <button type="button" data-nudge="15,0">北へ 15m</button>
        <button type="button" data-nudge="0,15">東へ 15m</button>
        <button type="button" data-nudge="-15,0">南へ 15m</button>
        <button type="button" data-nudge="0,-15">西へ 15m</button>
        <button type="button" data-reset>京都駅に戻す</button>
      </div>`
          : ''
      }
      <pre id="g2-metrics" class="g2-phone-metrics"></pre>
    </div>
    <style>
      .g2-phone-root {
        font-family: system-ui, sans-serif;
        line-height: 1.5;
        max-width: 40rem;
        margin: 0 auto;
        padding: 12px 16px 24px;
        box-sizing: border-box;
      }
      .g2-phone-preview-wrap {
        margin: 0 0 12px;
        background: #0a0c0e;
        border-radius: 10px;
        padding: 10px;
        border: 1px solid #1e3a2f;
      }
      .g2-phone-preview {
        display: block;
        width: 100%;
        max-width: 576px;
        height: auto;
        image-rendering: pixelated;
        border-radius: 4px;
        background: #000;
      }
      .g2-phone-preview-cap {
        font-size: 11px;
        color: #6b9b7a;
        margin: 8px 0 0;
        text-align: center;
      }
      .g2-phone-banner {
        margin: 0 0 10px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.4;
      }
      .g2-phone-manual {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .g2-phone-metrics {
        font-size: 12px;
        background: #f4f4f4;
        padding: 12px;
        border-radius: 8px;
        overflow: auto;
        white-space: pre-wrap;
        margin: 0;
      }
    </style>
  `;

  const banner = root.querySelector<HTMLElement>('#hub-mode-banner');
  if (banner) {
    if (hub.hubMode === 'simulation') {
      banner.style.background = '#1a2420';
      banner.style.color = '#8fd4a8';
      banner.textContent =
        `シミュレーション（約 ${VIEW_REFRESH_MS}ms 更新・北上固定）。`
        + ' 実機は .ehpk / HTTPS。'
        + (hub.hubDetail ? ` ${hub.hubDetail}` : '');
    } else {
      banner.style.background = '#e8f5e9';
      banner.style.color = '#1b5e20';
      banner.textContent = 'Even Hub 接続: G2 へ画像送信します。';
    }
  }

  if (showManual) {
    const manual = root.querySelector('#manual-geo');
    manual?.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const ctl = getManualGeoControls();
      if (!ctl) return;
      if (target.hasAttribute('data-reset')) {
        ctl.resetToFallback();
        return;
      }
      const raw = target.getAttribute('data-nudge');
      if (!raw) return;
      const [north, east] = raw.split(',').map(v => Number.parseFloat(v));
      if (!Number.isFinite(north) || !Number.isFinite(east)) return;
      ctl.nudgeMeters(north, east);
    });
  }

  const pre = root.querySelector('#g2-metrics');
  const previewImg = root.querySelector<HTMLImageElement>('#g2-phone-preview');

  const syncPreviewImage = () => {
    const url = getPhonePreviewUrl();
    if (!previewImg || !url) return;
    previewImg.src = url;
  };

  subscribePhonePreview(syncPreviewImage);

  if (onPreviewTap && previewImg) {
    previewImg.style.cursor = 'pointer';
    previewImg.title = 'タップで用途地域を表示／非表示';
    previewImg.addEventListener('click', () => onPreviewTap());
  }

  const refresh = () => {
    syncPreviewImage();
    if (!pre) return;
    const debug = getDebugBlock();
    pre.textContent =
      `${gps.formatReport()}\n\n${debug}\n\n${metrics.formatPhoneReport()}`;
  };
  refresh();
  return { refresh };
}
