# Web 実行時データ

`web/` をそのまま静的ホストに載せるとき、**この `data/` も同梱**してください（開発サーバーは `/data` → `web/data` を配信）。

## 構成

| パス | Git | 内容 |
| --- | --- | --- |
| `boundaries/*.geojson` | **含める** | 行政界（索引ビルド・2D 境界表示） |
| `mvt/manifest/` | ignore | 市区マスタ（`npm run build:mvt-index`） |
| `mvt/index/` | ignore | z12 親索引 |
| `snapshot/` | ignore | カタログ API スナップショット（ビルド用） |

## 生成

```bash
npm run build:mvt-index
```

初回やカタログ更新時はネットワークあり。再索引だけなら:

```bash
# Windows PowerShell
$env:SKIP_CATALOG_FETCH='1'; $env:REUSE_MANIFESTS='1'; npm run build:mvt-index
```

Viewer の MVT 参照: `/data/mvt`（`web/shared/mvt/data-region.js`）。
