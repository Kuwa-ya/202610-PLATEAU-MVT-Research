# 行政界データ

`r2ka13_city.geojson` は東京都63市区町村の行政界を収録した共有原本です。

- 2D Viewer: `/data/city_geojson/r2ka13_city.geojson` を境界線表示に使用
- 索引ビルダー: z16タイルと行政界Polygonの交差判定に使用
- 判定実装: `tools/build-mvt-index/admin-boundaries.js`

Viewer用とtools用に同じ約6.46MiBのファイルを複製せず、`data/`を実行時データとビルド入力の共有領域にしています。別都道府県を追加する場合も、このフォルダへ同じプロパティ構成のGeoJSONを配置し、ビルダーの入力一覧へ追加します。

現在、東京都は実ポリゴンで判定し、行政界データ未配置の埼玉県はmanifestのbbox判定へフォールバックします。
