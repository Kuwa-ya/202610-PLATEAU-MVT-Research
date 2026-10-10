# Even Hub SDK — 検証 2（画像送信）

[evenhub-templates/image](https://github.com/even-realities/evenhub-templates/tree/main/image) をベースに、3D Viewer で書き出した PNG を G2 の画像コンテナへ送る最小アプリです。

画像コンテナの **最大サイズは 288×144**（画面 576×288 の半分）。SDK がリサイズしますが、定義時もこの上限内にしてください。

## 手順

1. 同梱の `public/preview.png`（サンプル地形）で動作確認できる。実データに差し替える場合は 3D Viewer で「G2 向けプレビュー保存」し、同パスへコピー
2. サンプル再生成: リポジトリルートで `npm run generate:g2-preview`
3. `npm install` → **`npm run dev`**（Vite + シミュレータ + 実機用 QR を同時起動）
   - Vite だけ: `npm run dev:vite`
   - GPS 試行用 HTTPS: `npm run dev:https`（下記トレードオフ）
   - 個別: `npm run simulate` / `npx evenhub qr -u http://<IP>:5173/`
4. リポジトリルートから: `npm run dev:even-g2`

## HTTP と HTTPS（プロトタイプ vs GPS）

| コマンド | QR | プロトタイプ | GPS |
| --- | --- | --- | --- |
| **`npm run dev`**（既定） | `http://` | 開きやすい | ブラウザ上は **不可**（HTTP） |
| **`npm run dev:https`** | `https://` | 自己署名で **ロード中で止まる**ことがある | 理論上可能（WebView が TLS を通す場合） |

**「ロード中…」が続く** → いま `dev:https` なら **`npm run dev`（HTTP）に戻し QR を再スキャン**。以前と同様に同一 LAN・ファイアウォールを確認。

**実機 HTTP で端末 GPS が使えない** → ブラウザ仕様上正常。**シミュレータ**（`https://localhost` / Secure Context）では本物 GPS が動く。実機ではスマホ画面の **「北へ 15m」** 等で移動をシミュレートし、G2 への GPS 再送を確認（10m 閾値を超える）。タップ再送も引き続き利用可。

## 実機が「プロトタイプモード ロード中…」で止まる（HTTP でも）

1. ターミナルの `http://<IP>:5173/` を **スマホのブラウザ**で開く
2. 同一 Wi‑Fi・ファイアウォール（ポート 5173）— [Network & Firewall Setup](https://hub.evenrealities.com/docs/test/network-firewall)

## パック

```bash
npm run pack
```

生成された `.ehpk` を Even Hub 開発者ポータルから配布できます。

## 検証 3（送信性能）

初回表示とタップ再送のたびに計測します。

| 項目 | 内容 |
| --- | --- |
| サイズ | PNG バイト数 |
| fetch | `preview.png` 読み込み ms |
| SDK | `updateImageRawData` ms |
| 合計 | 1 フレームあたり end-to-end ms |

スマホ WebView のパネル、G2 下部ステータス、`[g2-metrics]` ログ、開発者コンソールの `window.__g2Metrics` を参照してください。

### 実測（2026-10-10・実機）

| 指標 | おおよその値 |
| --- | --- |
| 合計 / SDK / 平均 | **300〜400 ms** |

fetch はほぼ無視できるため、以降の最適化は **PNG サイズ縮小**より **送る回数の抑制**（GPS 間引き・方位のみでは再送しない）が効く。詳細は [`even-g2-3d-summary.md`](../../../../docs/even-g2-3d-summary.md) のベースライン表。

## 検証 4（GPS）

| 定数 | 値 |
| --- | --- |
| `GPS_MIN_MOVE_M` | 10 m |
| `GPS_MIN_INTERVAL_MS` | 500 ms |

初回 GPS fix は基準点設定のみ（画像は起動時の 1 枚）。移動で `trigger: gps` の再送。メトリクスに `trigger` 列あり。

## 次の拡張

- 現在地を原点に Three.js / MVT を描画してからキャプチャ
- 方位（検証 5）— 回転のみでは画像再送しない

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
