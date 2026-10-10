import { GPS_MIN_MOVE_M } from './config/defaults.js';
import type { GpsSession } from './geo/gps-session.js';
import { getManualGeoControls } from './geo/manual-geo-dev.js';
import type { FrameMetrics } from './metrics/frame-metrics.js';

export function mountPhonePanel(metrics: FrameMetrics, gps: GpsSession) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  const showManual = !window.isSecureContext;

  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5;max-width:36rem">
      <h1 style="font-size:1.1rem;margin:0 0 8px">PLATEAU MVT — G2 hub</h1>
      <p style="margin:0 0 12px;color:#555">
        検証 4: ${GPS_MIN_MOVE_M}m 以上の移動で画像再送（500ms 間隔）。
        シミュレータ (localhost) は本物 GPS、実機 HTTP は手動ボタンで同等テスト。
      </p>
      ${
        showManual
          ? `<div id="manual-geo" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <button type="button" data-nudge="0,15">北へ 15m</button>
        <button type="button" data-nudge="15,0">東へ 15m</button>
        <button type="button" data-nudge="0,-15">南へ 15m</button>
        <button type="button" data-nudge="-15,0">西へ 15m</button>
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
  const refresh = () => {
    if (!pre) return;
    pre.textContent = `${gps.formatReport()}\n\n${metrics.formatPhoneReport()}`;
  };
  refresh();
  return { refresh };
}
