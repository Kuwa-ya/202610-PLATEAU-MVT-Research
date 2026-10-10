# Even Hub SDK — 検証 2（画像送信）

[evenhub-templates/image](https://github.com/even-realities/evenhub-templates/tree/main/image) をベースに、3D Viewer で書き出した PNG を G2 の画像コンテナへ送る最小アプリです。

画像コンテナの **最大サイズは 288×144**（画面 576×288 の半分）。SDK がリサイズしますが、定義時もこの上限内にしてください。

## 手順

1. 同梱の `public/preview.png`（サンプル地形）で動作確認できる。実データに差し替える場合は 3D Viewer で「G2 向けプレビュー保存」し、同パスへコピー
2. サンプル再生成: リポジトリルートで `npm run generate:g2-preview`
3. `npm install` → **`npm run dev`**（Vite + シミュレータ + 実機用 QR を同時起動）
   - Vite だけ: `npm run dev:vite`
   - 個別: `npm run simulate` / `npx evenhub qr -u http://<IP>:5173/`
4. リポジトリルートから: `npm run dev:even-g2`

## 実機が「プロトタイプモード ロード中…」で止まる

多くは **PC とスマホが同じ LAN にない**（別 Wi‑Fi・VPN・テザリングのみ片方）か、**Windows ファイアウォールが 5173 を遮断**している場合です。

1. ターミナルに出た `http://<IP>:5173/` を **スマホのブラウザ**で開く → 表示できれば QR も通るはず
2. 表示できない → PC とスマホを同一 Wi‑Fi に揃える（ルーターの AP 隔離オフ、または PC をスマホのテザリングに接続）
3. まだ不可 → 受信規則で Node / ポート **5173** を許可（[Network & Firewall Setup](https://hub.evenrealities.com/docs/test/network-firewall)）

## パック

```bash
npm run pack
```

生成された `.ehpk` を Even Hub 開発者ポータルから配布できます。

## 次の拡張

- WebView 内で Three.js を動かし、キャプチャ → `updateImageRawData` をイベント駆動で呼ぶ
- GPS・方位は Hub / ブラウザ API から取得し、再描画のみ（データ再取得は分離）

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
