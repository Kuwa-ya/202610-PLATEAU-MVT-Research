# Even Hub SDK — 建物 GeoJSON → G2 画像

[evenhub-templates/image](https://github.com/even-realities/evenhub-templates/tree/main/image) をベースに、**現在地の PLATEAU 建物 GeoJSON**（kuwa-ya 本番 `geojson-gzip`）を取得し、俯図ポリゴンを **288×144 PNG** に描画して G2 へ送ります。

画像コンテナの **最大サイズは 288×144**（画面 576×288 の半分）。

## データフロー（`src/plateau/`）

1. GPS（未取得時は **京都駅** `config/defaults.ts`）
2. 11 桁地域メッシュ → `https://geo.kuwa-ya.co.jp/geojson-gzip/bldg/.../*.geojson.gz`
3. gzip 展開 → **南側 45° 俯瞰** の簡易立体（11 桁メッシュにフィット）→ G2 送信
4. スマホ `#app` 内に **同じ PNG プレビュー**（描画直後・G2 送信の直前に更新。再描画はしない）
4. PNG 化 → `updateImageRawData`

Three ビューワとは独立です（Three 側に G2 保存機能はありません）。

## 手順

1. `npm install` → **`npm run dev`**（Vite + シミュレータ + QR）
   - Vite だけ: `npm run dev:vite`
   - GPS 試行用 HTTPS: `npm run dev:https`
2. リポジトリルート: `npm run dev:even-g2`

## HTTP と HTTPS（プロトタイプ vs GPS）

| コマンド | QR | プロトタイプ | GPS |
| --- | --- | --- | --- |
| **`npm run dev`**（既定） | `http://` | 開きやすい | ブラウザ上は **不可**（HTTP） |
| **`npm run dev:https`** | `https://` | 自己署名で **ロード中で止まる**ことがある | 理論上可能 |

実機 HTTP では **「北へ 15m」** 等の手動移動＋タップ再送でメッシュ切替を確認できます。

## ビルド・パック

| コマンド | 出力 |
| --- | --- |
| `npm run build` | `web/data/output/even-g2/dist/` |
| `npm run pack` | `web/data/output/even-g2/plateau-mvt-g2.ehpk` |

`build` 時の `public/preview.png` 同期は CLI 互換用で、**実行時は GeoJSON 描画**が使われます。

## 検証 3（送信性能）

| 項目 | 内容 |
| --- | --- |
| fetch | GeoJSON 取得＋キャンバス描画 ms（ログの `geoMs` / `renderMs` も参照） |
| SDK | `updateImageRawData` ms |

## 検証 4（GPS）

`GPS_MIN_MOVE_M` = 10 m、`GPS_MIN_INTERVAL_MS` = 500 ms。移動で `trigger: gps` の再描画・再送。

## 次の拡張

- 複数メッシュの周辺読込、高さ・簡易 3D、方位（検証 5）

公式: [Display API](https://hub.evenrealities.com/docs/build/display)
