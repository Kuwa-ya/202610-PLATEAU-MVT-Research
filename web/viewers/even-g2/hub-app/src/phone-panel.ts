import { GPS_MIN_MOVE_M } from './config/defaults.js';
import type { GpsSession } from './geo/gps-session.js';
import { getManualGeoControls } from './geo/manual-geo-dev.js';
import type { FrameMetrics } from './metrics/frame-metrics.js';
import { getPhonePreviewUrl, subscribePhonePreview } from './preview/phone-preview.js';

export function mountPhonePanel(metrics: FrameMetrics, gps: GpsSession) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  const showManual = !window.isSecureContext;

  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5;max-width:36rem">
      <h1 style="font-size:1.1rem;margin:0 0 8px">PLATEAU MVT — G2 hub</h1>
      <p style="margin:0 0 12px;color:#555">
        検証 4: ${GPS_MIN_MOVE_M}m 以上の移動で画像再送（500ms 間隔）。
        下のプレビューは G2 と同じ 288×144（描画直後に更新、G2 送信は直後）。
      </p>
      <figure style="margin:0 0 12px">
        <img id="g2-phone-preview" alt="G2 プレビュー" width="288" height="144"
          style="display:block;max-width:100%;height:auto;border-radius:8px;border:1px solid #ccc;background:#1a1f24" />
        <figcaption style="font-size:11px;color:#777;margin-top:4px">モバイルプレビュー（南側 45° 俯瞰）</figcaption>
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

  const refresh = () => {
    syncPreviewImage();
    if (!pre) return;
    pre.textContent = `${gps.formatReport()}\n\n${metrics.formatPhoneReport()}`;
  };
  refresh();
  return { refresh };
}
