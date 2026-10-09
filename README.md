# PLATEAU MVT Research

PLATEAU が配信する MVT を、ローカル同梱の MapLibre GL JS で確認する静的サイトです。複数自治体の土地利用・道路、地域メッシュコード、Web Mercator タイル境界を同じ地図に重ねて確認できます。

## 起動

Node.js 20 以降。Three PoC 用に一度 `npm install` してください（MVT デコーダを `/vendor` 配信）。

```console
npm run dev
```

Windows PowerShell の実行ポリシーで `npm` を実行できない場合は、次を使います。

```console
npm.cmd run dev
```

ブラウザで <http://127.0.0.1:4173/> を開きます。Three.js MVT PoC は <http://127.0.0.1:4173/viewer-three/> です。終了は `Ctrl+C` です。ポートは環境変数 `PORT`、待受アドレスは `HOST` で変更できます。

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

- 2025年度の土地利用（`luse`）と道路（`tran-lod1`）を自治体コードで読み込み
- 複数自治体を同時表示し、同一 `gml_id` または完全に同じ形状の重複を先に指定した自治体へ寄せて非表示化
- ズーム5まで縮小可能。PLATEAU MVT は配信粒度に合わせてズーム14以上で表示
- 地域メッシュをズームに応じて4・6・8・9・10・11桁で切り替え、メッシュコードを表示
- Web Mercator タイル境界と `z/x/y` を表示（初期状態はオフ）
- 土地利用、道路、地域メッシュ、Web Mercator タイルを独立して重ね合わせ・表示切替

初期表示は東京都千代田区（`13101`）と中央区（`13102`）です。自治体コード欄にはカンマまたは空白区切りで最大8件まで指定できます。

## 構成

```text
.
├─ docs/                      調査資料、設計文書、参照実装
│  ├─ architecture.md        MVVM構成とデータフロー
│  ├─ ref/geojson/           メッシュ計算の参照元（実行時には未使用）
│  └─ research/              調査結果
├─ scripts/serve.js          開発用の小さな静的HTTPサーバー
├─ site/                     配信対象
│  ├─ index.html             画面構造とスタイル
│  ├─ js/                    Vanilla JS（配下は1階層まで）
│  │  ├─ app.js              起動処理（直下に置く唯一のJS）
│  │  ├─ model/              設定、入力検証、メッシュ計算
│  │  ├─ viewmodel/          画面状態と操作
│  │  ├─ view/               DOMイベントと状態描画
│  │  └─ services/           MapLibreとの境界
│  └─ vendor/maplibre-gl/    ローカル同梱ライブラリ
└─ package.json              開発コマンド
```

JavaScript は `.js` のままブラウザ標準の ES Modules（`import` / `export`）を使う Vanilla JS です。`.mjs`、バンドラー、ビルド処理は使いません。`app.js` だけを `site/js/` 直下に置き、役割別フォルダはその下の1階層までに限定しています。詳しくは [設計文書](docs/architecture.md) を参照してください。

## 確認

```console
npm run check
```

サーバーとサイト内の全 JavaScript を構文確認し、地域メッシュ・Web Mercator の既知座標テストも実行します。

## データとライセンス

静的な `data/` は置かず、背景地図と MVT は表示時に PLATEAU の配信 API から取得します。そのため地図表示にはインターネット接続が必要です。

MapLibre GL JS 5.24.0（BSD-3-Clause）は `site/vendor/maplibre-gl/` に同梱しています。ライセンス表示と更新方法は [vendor README](site/vendor/maplibre-gl/README.md) を参照してください。

地域メッシュと Web Mercator の計算は `docs/ref/geojson/js/geometric/` の実装を参照し、サイト用に `site/js/model/mesh-utils.js` へ必要部分を移植しています。参照実装そのものをサイトから読み込む依存関係はありません。

## Git運用

変更目的ごとに短いブランチを作り、コード・文書・参照資料を分けて確認してからコミットします。

```console
git switch -c feature/short-description
git add README.md docs site scripts package.json
git status
git commit -m "feat: add map overlay"
```

`dist/` と `node_modules/` は Git 管理対象外です。
