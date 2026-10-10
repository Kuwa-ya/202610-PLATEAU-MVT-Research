/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { VIEW_REFRESH_MS } from './config/defaults.js';
import { G2_PHONE_THEME } from './config/g2-phone-theme.js';
import { G2_CANVAS_H, G2_CANVAS_W, G2_IMAGE, G2_IMG_H, G2_IMG_W } from './hub/g2-page-layout.js';
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
  onPreviewTap?: () => void,
  getG2StatusMeta: () => string = () => '読み込み中…'
) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  const showManual = !window.isSecureContext;

  root.innerHTML = `
    <div class="g2-phone-root">
      <figure class="g2-phone-preview-wrap">
        <div
          id="g2-glasses-mock"
          class="g2-glasses-mock"
          role="img"
          aria-label="Even G2 画面プレビュー（576×288）"
        >
          <img id="g2-phone-preview" class="g2-glasses-map" alt="" width="${G2_IMG_W}" height="${G2_IMG_H}" />
          <pre id="g2-glasses-meta" class="g2-glasses-meta"></pre>
        </div>
        <figcaption class="g2-phone-preview-cap">眼鏡と同レイアウト（左 ${G2_IMG_W}×${G2_IMG_H} 地図・右メタ情報）。タップで用途地域 ON/OFF</figcaption>
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
      html, body {
        margin: 0;
        background: ${G2_PHONE_THEME.bgRoot};
      }
      .g2-phone-root {
        font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace;
        line-height: 1.5;
        max-width: 40rem;
        margin: 0 auto;
        padding: 12px 16px 24px;
        box-sizing: border-box;
        background: ${G2_PHONE_THEME.bgRoot};
        color: ${G2_PHONE_THEME.textPrimary};
        min-height: 100vh;
      }
      .g2-phone-preview-wrap {
        margin: 0 0 12px;
        background: ${G2_PHONE_THEME.bgPanel};
        border-radius: 10px;
        padding: 10px;
        border: 1px solid ${G2_PHONE_THEME.border};
      }
      .g2-glasses-mock {
        position: relative;
        width: 100%;
        max-width: ${G2_CANVAS_W}px;
        aspect-ratio: ${G2_CANVAS_W} / ${G2_CANVAS_H};
        background: ${G2_PHONE_THEME.bgMock};
        border-radius: 4px;
        overflow: hidden;
        margin: 0 auto;
        box-shadow: inset 0 0 0 1px ${G2_PHONE_THEME.border};
      }
      .g2-glasses-map {
        position: absolute;
        left: 0;
        top: ${(G2_IMAGE.y / G2_CANVAS_H) * 100}%;
        width: ${(G2_IMG_W / G2_CANVAS_W) * 100}%;
        height: ${(G2_IMG_H / G2_CANVAS_H) * 100}%;
        image-rendering: pixelated;
        background: ${G2_PHONE_THEME.bgMock};
        filter: ${G2_PHONE_THEME.mapFilter};
      }
      .g2-glasses-meta {
        position: absolute;
        left: ${((G2_IMG_W + 6) / G2_CANVAS_W) * 100}%;
        top: 0;
        right: 0;
        bottom: ${(4 / G2_CANVAS_H) * 100}%;
        margin: 0;
        padding: 6px 8px;
        box-sizing: border-box;
        font-family: inherit;
        font-size: clamp(10px, 2.6vw, 14px);
        line-height: 1.35;
        color: ${G2_PHONE_THEME.textPrimary};
        white-space: pre-wrap;
        overflow: hidden;
        background: transparent;
        border: none;
      }
      .g2-phone-preview-cap {
        font-size: 11px;
        color: ${G2_PHONE_THEME.textSecondary};
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
      .g2-phone-manual button {
        font-family: inherit;
        font-size: 12px;
        color: ${G2_PHONE_THEME.textPrimary};
        background: ${G2_PHONE_THEME.bgPanel};
        border: 1px solid ${G2_PHONE_THEME.border};
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .g2-phone-manual button:hover {
        border-color: ${G2_PHONE_THEME.textSecondary};
      }
      .g2-phone-metrics {
        font-size: 12px;
        font-family: inherit;
        color: ${G2_PHONE_THEME.textSecondary};
        background: ${G2_PHONE_THEME.bgPanel};
        border: 1px solid ${G2_PHONE_THEME.border};
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
  const metaEl = root.querySelector<HTMLElement>('#g2-glasses-meta');
  const glassesMock = root.querySelector<HTMLElement>('#g2-glasses-mock');

  const syncPreviewImage = () => {
    const url = getPhonePreviewUrl();
    if (!previewImg || !url) return;
    previewImg.src = url;
  };

  const syncGlassesMeta = () => {
    if (metaEl) metaEl.textContent = getG2StatusMeta();
  };

  subscribePhonePreview(() => {
    syncPreviewImage();
    syncGlassesMeta();
  });

  if (onPreviewTap && glassesMock) {
    glassesMock.style.cursor = 'pointer';
    glassesMock.title = 'タップで用途地域を表示／非表示';
    glassesMock.addEventListener('click', event => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest('#g2-glasses-meta')) return;
      onPreviewTap();
    });
  }

  const refresh = () => {
    syncPreviewImage();
    syncGlassesMeta();
    if (!pre) return;
    const debug = getDebugBlock();
    pre.textContent =
      `${gps.formatReport()}\n\n${debug}\n\n${metrics.formatPhoneReport()}`;
  };
  refresh();
  return { refresh };
}
