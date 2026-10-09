# 静的 MVT 索引データ

`npm run build:mvt-index` で生成します。

| パス | 内容 |
| --- | --- |
| `snapshot/` | データカタログ API のスナップショット |
| `manifest/` | 市区マスタ（TileJSON 解決済み） |
| `index/{dataset}/12/{x}/{y}.json` | z12 親 → z16 子 → 市区コード配列 |

PoC 範囲は東京都＋埼玉県外接矩形（z12 親 154 件）。
