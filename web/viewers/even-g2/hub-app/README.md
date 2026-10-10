# Even Hub SDK — 建物 GeoJSON → G2 画像

**現在地周辺の PLATEAU 建物 GeoJSON**（kuwa-ya 本番）を WebGL で斜め俯瞰し、**288×144** の PNG を G2 へ送ります（Even 接続時）。地図は **北上固定**、黄矢印は **直前位置からの移動方向**。

## 開発モード（推奨）

| コマンド | 用途 |
| --- | --- |
| **`npm run dev`** | Vite + **evenhub-simulator** + QR。`VITE_HUB_MODE=auto` — **シミュレータは G2 表示**、実機 QR はブリッジなしなら約 3 秒後プレビューのみ |
| **`npm run simulate`** | シミュレータだけ（Vite は別途 `dev:vite`） |
| **`npm run dev:even`** | `VITE_HUB_MODE=even` — ブリッジ必須で G2 送信 |

HTTP の実機 QR で「プロトタイプ・読み込み中…」が続くのは **Even WebView / TLS / ブリッジ**の制約が多いです。  
**日常の検証はシミュレータ＋モバイルプレビュー**、**実機 G2 は `npm run pack` の `.ehpk`** で確認する想定です。

## 本番・実機 G2

```bash
npm run build    # VITE_HUB_MODE=even（vite production）
npm run pack     # web/data/output/even-g2/plateau-mvt-g2-v{app.json version}.ehpk

`npm run build` / `pack` の前に、リポジトリルートで **`npm run build:mvt-index:use-district`** を実行してください（用途地域 manifest・索引を `.ehpk` に同梱します）。
```

Even Hub ポータルへ `.ehpk` をアップロード（Private build）。

## データ・描画

- GeoJSON DL: 中心 **11 桁メッシュが変わったとき**（同一タイル内はキャッシュ再利用）
- 取得範囲: 11 桁中心の **3×3（最大 9 タイル）** をマージ
- 再描画: 約 **500 ms** ポーリング。移動 **&lt; 0.5 m** かつ同一メッシュならスキップ（`defaults.ts`）
- G2 レイアウト: **左 288×144 地図**、**右テキスト** — 載せる項目の正本は [g2-display-and-address.md](../../../../docs/design/g2-display-and-address.md)（標高・緯度経度・16 方位・住所・タップ時用途地域。性能・メッシュはモバイルのみ）
- 描画: 既定 **Three.js WebGL**（`VIEW_RENDER_BACKEND=webgl`）。`canvas2d` で `render-oblique.ts` に切替可
- 建物: 半透明。現在地はリング＋ポールで強調
- カメラ: kuwaya 型球面（**南側固定**・ユーザー注視）。既定 **仰角 60°**（**15°〜90°**、G2 **上/下スワイプ**で変更）。距離既定約 **280 m**

## 検証の位置づけ（親 README と共通）

| # | 内容 | 状態 |
| --- | --- | --- |
| 1–2 | 静止画 / SDK 最小アプリ | 済 |
| 3 | 送信性能（実機 **300〜400 ms** 程度） | 済 |
| 4 | GPS → 位置に応じた再描画 | 済（実機 `.ehpk` でも確認済み想定） |
| 5+ | 用途地域・建ぺい率・容積率など | **一部** — 中心タップで照会・右テキスト・紫枠。**ON 時は用途地域内の建物のみ描画**（`docs/design/use-district-clip-g2.md`） |

## HTTP / GPS

| | QR 実機 HTTP | シミュレータ |
| --- | --- | --- |
| **auto（`npm run dev`）** | ブリッジなし → プレビュー | **G2 表示** |
| **simulation**（`dev:vite` 単体） | プレビュー可 | プレビューのみ |
| **even** | 不安定になりがち | `dev:even` で試す |
| **.ehpk** | アプリ経由で検証 | — |

実機 HTTP では Geolocation が使えないことが多い → 開発用 **手動 15 m 移動ボタン**（非 Secure Context 時）。シミュレータ／localhost では GPS 可。

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
