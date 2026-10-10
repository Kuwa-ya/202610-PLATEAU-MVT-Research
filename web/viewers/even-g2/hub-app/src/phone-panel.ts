import { VIEW_REFRESH_MS } from './config/defaults.js';
import { getViewCameraStatusLine } from './view/view-camera-state.js';
import type { GpsSession } from './geo/gps-session.js';
import type { HeadingSession } from './geo/heading-session.js';
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
  heading: HeadingSession,
  onViewRefresh: () => void,
  hub: PhonePanelHubInfo = { hubMode: 'simulation' }
) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  const showManual = !window.isSecureContext;

  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5;max-width:36rem">
      <h1 style="font-size:1.1rem;margin:0 0 8px">PLATEAU MVT — G2 hub</h1>
      <p id="hub-mode-banner" style="margin:0 0 8px;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.4"></p>
      <p style="margin:0 0 12px;color:#555">
        約 ${VIEW_REFRESH_MS}ms ごとに再描画（GeoJSON は 11 桁メッシュが変わったときだけ DL）。
        青い矢印＝進行方位（GPS）。G2 実機では<strong>上/下スワイプ</strong>でカメラ仰角。
      </p>
      <figure style="margin:0 0 12px">
        <img id="g2-phone-preview" alt="G2 プレビュー" width="288" height="144"
          style="display:block;max-width:100%;height:auto;border-radius:8px;border:1px solid #ccc;background:#1a1f24" />
        <figcaption style="font-size:11px;color:#777;margin-top:4px">モバイルプレビュー（南側 45°）</figcaption>
      </figure>
      ${
        showManual
          ? `<div id="manual-geo" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <button type="button" data-nudge="15,0">北へ 15m</button>
        <button type="button" data-nudge="0,15">東へ 15m</button>
        <button type="button" data-nudge="-15,0">南へ 15m</button>
        <button type="button" data-nudge="0,-15">西へ 15m</button>
        <button type="button" data-reset>京都駅に戻す</button>
      </div>`
          : ''
      }
      <pre id="g2-metrics" style="font-size:12px;background:#f4f4f4;padding:12px;border-radius:8px;overflow:auto"></pre>
    </div>
  `;

  const banner = root.querySelector<HTMLElement>('#hub-mode-banner');
  if (banner) {
    if (hub.hubMode === 'simulation') {
      banner.style.background = '#fff8e6';
      banner.style.color = '#664d00';
      banner.textContent =
        'シミュレーションモード: 下のプレビューだけ更新します（G2 は送りません）。'
        + ' 実機 G2 は .ehpk または HTTPS 配布で検証してください。'
        + (hub.hubDetail ? ` (${hub.hubDetail})` : '');
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
        heading.resetManual();
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

  const refresh = () => {
    syncPreviewImage();
    if (!pre) return;
    const headingLine = `表示向き: ${heading.getHeadingDeg().toFixed(0)}°`;
    pre.textContent =
      `${gps.formatReport()}\n${heading.formatHeadingStatus()}\n${headingLine}\n${getViewCameraStatusLine()}\n\n${metrics.formatPhoneReport()}`;
  };
  refresh();
  return { refresh };
}
