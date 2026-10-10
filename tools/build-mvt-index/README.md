# MVT 静的索引ビルド

設計: [`docs/design/mvt-static-tile-index.md`](../../docs/design/mvt-static-tile-index.md)

## 実行

```bash
npm run build:mvt-index
```

- カタログを `web/data/snapshot/plateau-datasets-2025.json` に保存
- `web/data/mvt/manifest/` … 市区マスタ
- `web/data/mvt/index/{dataset}/12/{x}/{y}.json`

市区 bbox は [JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson) を参照します。TileJSON は各自治体ごとに 1 回取得します。

## 環境変数

| 変数 | 意味 |
| --- | --- |
| `SKIP_CATALOG_FETCH=1` | スナップショット JSON を再利用（TileJSON 取得は行う） |
| `MVT_DATASET_ID` | カンマ区切りでデータセットだけビルド（例: `use-district-2025`） |
| `REUSE_MANIFESTS=1` | 既存 manifest を読み直して index だけ再生成 |

用途地域のみ:

```bash
npm run build:mvt-index:use-district
```

`urf:UseDistrict` は composite TileJSON が別地物型を指すため、manifest はカタログの **直 URL テンプレート** を記録します。
