# Even G2 向けアプリ

## いまできること（検証 1）

1. [3D Viewer](/viewers/three/) で京都周辺を表示
2. **G2 向けプレビュー保存** → `web/shared/g2/canvas-capture.js` で最大幅 640px の PNG
3. [even-g2/index.html](./index.html) で手順とプレビュー確認

## 検証 2 — Even Hub SDK（最小アプリ）

[`hub-app/`](./hub-app/) に Vite + `@evenrealities/even_hub_sdk` の構成があります。

1. `hub-app/public/preview.png` は同梱済み（`npm run generate:g2-preview` で再生成可）。実画面に差し替える場合は検証 1 の PNG を同パスへコピー
2. `cd hub-app && npm install && npm run dev`（開発サーバー・シミュレータ・実機 QR を一括起動）
3. ルートからは `npm run dev:even-g2` でも可

## これから（検証 3 以降）

- WebView 内での Three.js 描画 → 自動キャプチャ送信
- GPS・方位・現在地属性（用途地域・建ぺい率・容積率）
- 同梱データ: `web/data/`（`DATA_BASE` = `/data/mvt`）

公式: [Even Hub ドキュメント](https://hub.evenrealities.com/docs/build/display)

## 用途地域 MVT の調査

```bash
npm run probe:kyoto-usedistrict
```
