import type { FrameMetrics } from './metrics/frame-metrics.js';

export function mountPhonePanel(metrics: FrameMetrics) {
  const root = document.querySelector('#app');
  if (!root) return { refresh: () => {} };

  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5;max-width:36rem">
      <h1 style="font-size:1.1rem;margin:0 0 8px">PLATEAU MVT — G2 hub</h1>
      <p style="margin:0 0 12px;color:#555">
        検証 2: 画像表示 / 検証 3: 下の計測値を実機で記録します。
        タップで再送し、遅延のばらつきを確認してください。
      </p>
      <pre id="g2-metrics" style="font-size:12px;background:#f4f4f4;padding:12px;border-radius:8px;overflow:auto"></pre>
    </div>
  `;

  const pre = root.querySelector('#g2-metrics');
  const refresh = () => {
    if (pre) pre.textContent = metrics.formatPhoneReport();
  };
  refresh();
  return { refresh };
}
