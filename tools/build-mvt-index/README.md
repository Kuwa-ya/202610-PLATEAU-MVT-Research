# MVT 静的索引ビルド

設計: [`docs/design/mvt-static-tile-index.md`](../../docs/design/mvt-static-tile-index.md)

## 実行

```bash
npm run build:mvt-index
```

- カタログを `data/snapshot/plateau-datasets-2025.json` に保存
- `data/manifest/luse-2025.json` / `tran-lod1-2025.json`
- `data/index/{dataset}/12/{x}/{y}.json`（PoC 矩形内 z12 親 **154 件**）

市区 bbox は [JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson) を参照します。TileJSON は各自治体ごとに 1 回取得します。

## 環境変数

| 変数 | 意味 |
| --- | --- |
| `SKIP_CATALOG_FETCH=1` | スナップショット JSON を再利用（TileJSON 取得は行う） |
