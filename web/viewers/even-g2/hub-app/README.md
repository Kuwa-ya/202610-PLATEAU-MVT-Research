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
npm run pack     # plateau-mvt-g2-v{app.jsonのversion}.ehpk（上書きしない）
```

Even Hub ポータルへ `.ehpk` をアップロード（Private build）。

## データ・描画

- GeoJSON DL: **11 桁メッシュが変わったときだけ**（`mesh-data-key.ts`）
- 描画: 約 **500ms** ＋ 位置/方位の微小変化
- G2 レイアウト: **左 288×144 地図**、**右半分をテキスト 2 段**（位置・メッシュ / カメラ・送信）
- 既定は **Three.js WebGL** → 288×144 canvas → PNG → G2（`defaults.ts` の `VIEW_RENDER_BACKEND`。`canvas2d` で従来の `render-oblique.ts`）
- 方位: **GPS 進行方位**（静止時は 0°＝北）
- カメラ: kuwaya Three 同型の球面（南固定・ユーザー注視）。G2 **上/下スワイプ**で仰角。距離既定約 280 m
- 建物: 現在地 11 桁メッシュの **3×3 タイル**（最大 9 本の GeoJSON）をマージ

## HTTP / HTTPS

| | QR 実機 HTTP | シミュレータ |
| --- | --- | --- |
| **auto（`npm run dev`）** | ブリッジなし → プレビュー | **G2 表示** |
| **simulation**（`dev:vite` 単体） | プレビュー可 | プレビューのみ |
| **even** | 不安定になりがち | `dev:even` で試す |
| **.ehpk** | アプリ経由で検証 | — |

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
