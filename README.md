# PLATEAU MVT Research

PLATEAU が配信する MVT を、ローカル同梱の MapLibre GL JS で確認する静的サイトです。静的タイル索引で自治体別MVTを自動選択し、土地利用・道路、地域メッシュコード、Web Mercator タイル境界を同じ地図に表示できます。

## 起動

Node.js 20 以降。Three PoC 用に一度 `npm install` してください（MVT デコーダを `/vendor` 配信）。

```console
npm run dev
```

Windows PowerShell の実行ポリシーで `npm` を実行できない場合は、次を使います。

```console
npm.cmd run dev
```

ブラウザで <http://127.0.0.1:4173/> を開き、2D／3D Viewerを選択します。2Dは `/viewers/maplibre/`、3Dは `/viewers/three/` です。終了は `Ctrl+C` です。ポートは環境変数 `PORT`、待受アドレスは `HOST` で変更できます。

静的索引（東京都＋埼玉県）を生成する場合:

```console
npm run build:mvt-index
```

詳細は [`tools/build-mvt-index/README.md`](tools/build-mvt-index/README.md) と [`docs/design/mvt-static-tile-index.md`](docs/design/mvt-static-tile-index.md) を参照してください。

```powershell
$env:PORT = 8080
npm.cmd run dev
```

## 地図の機能

- 2025年度の土地利用（`luse`）と道路（`tran-lod1`）をz16タイル単位で自動読み込み
- 土地利用MVTの `uro_orgLandUse` が「道路」の地物を橙色で表示（2D・3D共通）
- 3D表示と同じ静的索引を使い、各タイルに複数の候補自治体がある場合は全自治体のMVTを重ねて表示
- `data/city_geojson/r2ka13_city.geojson` の東京都63市区町村境界を比較用ラインとして表示
- ズーム5まで縮小可能。PLATEAU MVT は索引粒度に合わせてズーム16以上で表示
- 地域メッシュをズームに応じて4・6・8・9・10・11桁で切り替え、メッシュコードを表示
- Web Mercator タイル境界と `z/x/y` を表示（初期状態はオフ）
- Web Mercator タイル番号には、土地利用・道路MVTの取得先自治体コードを併記
- 土地利用、道路、地域メッシュ、Web Mercator タイルを独立して重ね合わせ・表示切替
- 東京都のz16索引は行政界Polygonとの内包・境界交差で絞り込み、bboxだけが重なる範囲外タイルを除外

初期表示は東京駅周辺です。表示範囲内の自治体はタイル索引から自動選択されるため、自治体コードの指定は不要です。

## 構成

MVTのデコード、自治体・タイル境界での同一ID結合、重複排除の方針は [`docs/design/mvt-decode-merge-dedup.md`](docs/design/mvt-decode-merge-dedup.md) を参照してください。

```text
.
├─ docs/                      調査資料、設計文書、参照実装
│  ├─ architecture.md        MVVM構成とデータフロー
│  ├─ ref/geojson/           メッシュ計算の参照元（実行時には未使用）
│  └─ research/              調査結果
├─ scripts/serve.js          開発用の小さな静的HTTPサーバー
├─ web/                      Web配信ルート
│  ├─ index.html             2D／3D Viewer選択
│  ├─ viewers/maplibre/      2D Viewer
│  ├─ viewers/three/         3D Viewer
│  ├─ shared/mvt/            Viewer共通のMVT処理
│  └─ vendor/                MapLibre・Three.js同梱物
└─ package.json              開発コマンド
```

JavaScriptは `.js` のままブラウザ標準のES Modulesを使います。Viewer固有処理は `web/viewers/`、共有処理は `web/shared/` に配置します。詳しくは[設計文書](docs/architecture.md)を参照してください。

## 確認

```console
npm run check
```

サーバーとサイト内の全 JavaScript を構文確認し、地域メッシュ・Web Mercator の既知座標テストも実行します。

## データとライセンス

`data/manifest/` と `data/index/` に東京都・埼玉県の静的索引を配置しています。背景地図と索引が選択したMVT本体は表示時に外部配信元から取得するため、地図表示にはインターネット接続が必要です。

MapLibre GL JS 5.24.0（BSD-3-Clause）は `web/vendor/maplibre-gl/`、Three.jsは `web/vendor/three/` に同梱しています。MapLibreの詳細は[vendor README](web/vendor/maplibre-gl/README.md)を参照してください。

地域メッシュとWeb Mercatorの計算は `docs/ref/geojson/js/geometric/` の実装を参照し、2D Viewer用に `web/viewers/maplibre/js/model/mesh-utils.js` へ必要部分を移植しています。

## Git運用

変更目的ごとに短いブランチを作り、コード・文書・参照資料を分けて確認してからコミットします。

```console
git switch -c feature/short-description
git add README.md docs data scripts tools web package.json package-lock.json
git status
git commit -m "feat: add map overlay"
```

`dist/` と `node_modules/` は Git 管理対象外です。
