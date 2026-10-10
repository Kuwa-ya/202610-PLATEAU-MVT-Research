# Even Hub SDK — 建物 GeoJSON → G2 画像

**現在地の PLATEAU 建物 GeoJSON**（kuwa-ya 本番）を **南側 45° 俯瞰**で描画し、288×144 PNG を G2 へ送ります（Even 接続時）。

## 開発モード（推奨）

| コマンド | 用途 |
| --- | --- |
| **`npm run dev`** | Vite + **evenhub-simulator** + QR。`VITE_HUB_MODE=auto` — **シミュレータは G2 表示**、実機 QR はブリッジなしなら約 3 秒後プレビューのみ |
| **`npm run simulate`** | シミュレータだけ（Vite は別途 `dev:vite`） |
| **`npm run dev:even`** | `VITE_HUB_MODE=even` — ブリッジ必須で G2 送信 |

HTTP の実機 QR で「プロトタイプ・読み込み中…」が続くのは **Even WebView / TLS / ブリッジ**の制約が多いです。  
**日常の検証はシミュレータ＋モバイルプレビュー**、**実機 G2 は `npm run pack` の `.ehpk` または HTTPS 配布**で確認する想定です。

## 本番・実機 G2

```bash
npm run build    # VITE_HUB_MODE=even（vite production）
npm run pack     # plateau-mvt-g2.ehpk
```

Even Hub ポータルへ `.ehpk` をアップロード（Private build）。

## データ・描画

- GeoJSON DL: **11 桁メッシュが変わったときだけ**（`mesh-data-key.ts`）
- 描画: 約 **750ms** ＋ 位置/方位の微小変化
- 既定は **Three.js WebGL** → 288×144 canvas → PNG → G2（`defaults.ts` の `VIEW_RENDER_BACKEND`。`canvas2d` で従来の `render-oblique.ts`）
- 方位: **手動 ±15°**（歩行中は GPS 進行方位を加味）

## HTTP / HTTPS

| | QR 実機 HTTP | シミュレータ |
| --- | --- | --- |
| **auto（`npm run dev`）** | ブリッジなし → プレビュー | **G2 表示** |
| **simulation**（`dev:vite` 単体） | プレビュー可 | プレビューのみ |
| **even** | 不安定になりがち | `dev:even` で試す |
| **.ehpk** | アプリ経由で検証 | — |

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
