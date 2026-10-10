# 京都 zoom 16 MVT ゲート

東京と同観点で、**本格開発前に京都駅周辺で z16 を合格とみなす**ための自動チェックと手動確認の目安。

## 地点・タイル

| 項目 | 値 |
| --- | --- |
| 地点 | 京都駅 `34.986, 135.759`（`web/shared/geo/viewer-defaults.js`） |
| 取得ズーム | **16**（配信の最詳細。表示 z17+ はオーバーズーム） |
| 京都市 MVT コード | `26100`（政令市一体。索引は区コード `26101`–`26111` も可） |

## 合格基準（自動）

`npm run verify:kyoto-z16-gate` が **exit 0** であること。

1. **配信 TileJSON** — 京都市 `luse` の `maxzoom >= 16`
2. **MVT 取得** — 京都駅タイルのバイト長 `>= 8`（空タイルでない）
3. **デコード** — 土地利用レイヤに **1 件以上**のポリゴン
4. **静的索引**（`web/data/mvt/` が存在する場合）— `luse-2025` の当該 z16 キーに市区コードが **1 件以上**
5. **用途地域**（索引・manifest がある場合）— `queryUseDistrictAtLonLat` が **null 以外**、または manifest 未生成時はスキップ

索引・manifest が無い環境では 4–5 は WARN のみ（CI では `build:mvt-index` 後に再実行）。

## 手動確認（推奨）

- 2D MapLibre: 京都駅へ移動、土地利用 ON、タイル境界で継ぎ目・欠けがないか
- 3D: カメラ 900 m 以内で MVT 表示、PLATEAU Ortho 地表と位置ずれが許容範囲か
- Even G2: 中心タップで用途地域サマリ＋紫枠（pack 同梱索引あり）

## 関連コマンド

```bash
npm run probe:kyoto-mvt
npm run probe:kyoto-usedistrict
npm run verify:kyoto-z16-gate
npm run build:mvt-index
npm run build:mvt-index:use-district
```
