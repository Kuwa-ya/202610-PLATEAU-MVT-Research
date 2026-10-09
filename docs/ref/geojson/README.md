# GeoJSON Viewer for PLATEAU (2D)

GeoJSON を Leaflet 上で確認する、ブラウザ完結の 2D ビューアです。

## 起動

リポジトリの `localdev` ディレクトリで依存関係をインストールし、サーバーを起動します。

```bash
npm install
node server.js
```

ブラウザで `http://localhost:3000/geojson` を開きます。ポートは環境変数 `PORT` で変更できます。

## API

サイドバーからID（メールアドレス）とパスワードでログインすると、地図上で地域メッシュを選択して `building`、`road`、`use_district`、`height_control_district`、`fire_prevention_district`、`land_use`、`district_plan` を取得できます。取得したFeatureCollectionは既存のレイヤ機能（表示切替、属性、色分け、フィルタ）で扱えます。

住所検索は入力値を限定せず、任意の文字列を仕様どおり `POST /address/geocode` へ送り、結果をレイヤとして追加して地図をフォーカスします。住所APIはJWTではなく `X-Address-Api-Key` が必要です。

APIのURL、RESTパス、住所APIキーはすべて [指定の設定JSON](https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json) から読み込みます。JS側のAPI URL・APIキー・環境変数によるフォールバックはありません。

`localhost` または `127.0.0.1` で `localdev/server.js` を使う場合は、設定JSONも `/devegokko-config.json` 経由で取得し、ブラウザのCORSを避けるためAPI通信は同一オリジンの `/devegokko-api` を経由します。

このプロキシは開発用です。ログイン・GeoJSON・住所の必要なPOSTパスだけを許可し、`127.0.0.1` / `::1` からのアクセスに限定しています。本番公開時はこの開発プロキシを公開せず、API側のCORS設定または認証済みのサーバーサイドプロキシを使用してください。

## データの読み込み

- ローカル: `.geojson`、`.json`、またはそれらを含む `.zip`
- URL: GeoJSON を返す URL

リポジトリ内の静的 `data` ディレクトリや manifest から読み込む機能はありません。

## 構成

`AppViewModel` を状態の唯一のソースとし、`AppView` が DOM と Leaflet に反映します。View の操作は `appCommands` を通じて ViewModel に渡されます。

- `app/viewmodel/AppViewModel.js`: 状態、レイヤー管理、フィルター、色分け
- `app/view/AppView.js`: DOM イベントと状態描画
- `app/services/LeafletMapAdapter.js`: Leaflet の操作
- `app/loaders/`: ローカル、URL、API の読み込み
- `app/model/geoJsonHelpers.js`: ビューア固有の GeoJSON 属性処理

地域メッシュと Web Mercator `z/x/y` は独立したオーバーレイレイヤーです。それぞれ地図パネルから個別に表示を切り替えられます。

地域メッシュは表示ズームに応じて、4桁（ズーム9以下）、6桁（10〜13）、8桁（14〜15）、9〜11桁（16以上）を切り替えます。広域時は日本周辺に限定して描画します。

`tide-viewer/js/geojson` と `tide-viewer/js/geometric` からコピーしたライブラリを `js/geojson/` と `js/geometric/` に配置しています。ビューアはコピー先だけを参照するため、ほかのビューアには依存しません。

## 開発時の確認

変更ごとにローカルサーバーで `/geojson` を開き、起動エラーがないこと、地図移動後も両メッシュが更新されること、各入力方法で GeoJSON を読み込めることを確認してください。
