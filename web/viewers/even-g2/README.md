# Even G2 向けアプリ

## いまできること（検証 1）

1. [3D Viewer](/viewers/three/) で京都周辺を表示
2. **G2 向けプレビュー保存** → `web/shared/g2/canvas-capture.js` で最大幅 640px の PNG
3. [even-g2/index.html](./index.html) で手順とプレビュー確認

## 検証 2 — Even Hub SDK（最小アプリ）

[`hub-app/`](./hub-app/) に Vite + `@evenrealities/even_hub_sdk` の構成があります。

1. プレビュー PNG の正本は **`web/data/output/previews/`**（Git 外）。`npm run generate:g2-preview` で生成。実キャプチャは `web/data/output/g2-captures/` へ置き、必要なら `preview.png` にコピー
2. `cd hub-app && npm install && npm run dev`（開発サーバー・シミュレータ・実機 QR を一括起動）
3. ルートからは `npm run dev:even-g2` でも可

## ビルド・パック（成果物の場所）

| 成果物 | パス |
| --- | --- |
| Web バンドル | `web/data/output/even-g2/dist/` |
| 配布用パッケージ | `web/data/output/even-g2/plateau-mvt-g2-v{version}.ehpk`（`app.json` の version） |

```bash
npm run pack:even-g2
```

## 検証 3 — 送信性能（実測済み）

hub-app で計測。実機では合計・SDK・平均とも **おおよそ 300〜400 ms**（静的 PNG・タップ再送）。ボトルネックは `updateImageRawData` 経路。検証 3 の完了条件は満たしている。

計測 UI: スマホパネル / G2 ステータス / `window.__g2Metrics.getSamples()`。

## 検証 4 — GPS ＋ 現在地建物描画

hub-app で GPS（または手動移動）に連動し、**kuwa-ya 建物 GeoJSON** を WebGL 描画して G2 送信。詳細は [`hub-app/README.md`](./hub-app/README.md)。

## これから（B）

1. **2D Viewer** — 用途地域 `use-district-2025` 索引＋MapLibre レイヤー（クリックで建ぺい率・容積率）。索引生成: `npm run build:mvt-index:use-district`
2. **G2** — 2D で属性確認後、右テキストを **タップで情報切替** などに整理して属性表示。

同梱データ: `web/data/`（`DATA_BASE` = `/data/mvt`）

公式: [Even Hub ドキュメント](https://hub.evenrealities.com/docs/build/display)

## 用途地域 MVT の調査

```bash
npm run probe:kyoto-usedistrict
```
