# Web 実行時データ

`web/` をそのまま静的ホストに載せるとき、**この `data/` も同梱**してください（開発サーバーは `/data` → `web/data` を配信）。

## 構成

| パス | Git | 内容 |
| --- | --- | --- |
| `boundaries/*.geojson` | **含める** | 行政界（索引ビルド・2D 境界表示） |
| `mvt/manifest/` | ignore | 市区マスタ（`npm run build:mvt-index`） |
| `mvt/index/` | ignore | z12 親索引 |
| `snapshot/` | ignore | カタログ API スナップショット（ビルド用） |
| `output/previews/` | ignore | G2 用プレビュー PNG（`npm run generate:g2-preview`） |
| `output/g2-captures/` | ignore | 3D Viewer などからの書き出し PNG（手動配置） |
| `output/even-g2/dist/` | ignore | Even G2 hub-app の Vite 本番ビルド |
| `output/even-g2/*.ehpk` | ignore | `npm run pack:even-g2` のパッケージ（ポータルへアップロード） |

`output/` 配下は **Git に含めません**。ディレクトリだけ `.gitkeep` で保持します。

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

### G2 プレビュー画像

```bash
npm run generate:g2-preview
```

- 正本: `output/previews/preview.png`, `sample-preview.png`
- hub-app ビルド時は `ensure-g2-preview.js` が `hub-app/public/preview.png` に同期
- 実キャプチャは `output/g2-captures/` に置き、必要なら `preview.png` を上書きコピー

### Even G2 ビルド（hub-app）

```bash
npm run build:even-g2   # → web/data/output/even-g2/dist/
npm run pack:even-g2    # 上記のあと → web/data/output/even-g2/plateau-mvt-g2.ehpk
```

ソースは `web/viewers/even-g2/hub-app/`。成果物だけ `output/even-g2/` に集約します。
