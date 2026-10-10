# サイト構成

## 方針

Webアプリはビルド不要のVanilla JSとし、ブラウザ標準ES Modulesで接続します。`web/viewers/maplibre/`と`web/viewers/three/`にViewer固有処理、`web/shared/`に共通MVT処理、`web/vendor/`に同梱ライブラリを配置します。

## 責務

| ファイル | 区分 | 責務 |
|---|---|---|
| `model/model.js` | Model | 年度・表示閾値、レイヤーID、地物識別 |
| `model/mesh-utils.js` | Model | 地域メッシュと Web Mercator タイルの純粋計算 |
| `viewmodel/app-view-model.js` | ViewModel | 画面状態の唯一の保持元、操作による状態更新、変更通知 |
| `view/app-view.js` | View | DOMイベントを ViewModel に渡し、状態をDOMへ反映 |
| `services/map-adapter.js` | View Adapter | MapLibreの初期化、MVT・グリッド・ラベル描画、地図イベント通知 |
| `services/indexed-mvt-protocol.js` | Service | z16タイルを静的索引から自治体別MVT URLへ解決 |
| `app.js` | Composition Root | 各要素の生成とコールバック接続。`web/viewers/maplibre/js/` 直下に配置 |

### Three.js Viewer（`web/viewers/three/js/`）

MapLibre と同様に MVVM を分離します。`app.js` は Composition Root のみです。

| ファイル | 区分 | 責務 |
|---|---|---|
| `model/model.js` | Model | 初期画面状態・MVT 距離などの定数 |
| `viewmodel/app-view-model.js` | ViewModel | ステータス・ローディング・MVT メタデータ・原点の保持と通知 |
| `view/app-view.js` | View | DOM 操作とユーザー操作の受け口、ViewModel の状態反映 |
| `view/view-ui.js` | View | 要素参照・タブ UI・メタデータ表示ヘルパ |
| `services/scene-adapter.js` | View Adapter | Three.js シーン、地形 PoC、MVT 同期、カメラループ |
| `services/mvt-*.js` 等 | Service | MVT 索引・デコード・メッシュ、地形 PoC、座標系 |

## データフロー

```text
利用者の操作
    ↓
AppView ──操作──→ AppViewModel ──状態通知──→ AppView
                                               │
                                               └──状態──→ MapAdapter
                                                            │
地図移動・地物選択 ←──────── コールバック ──────────────────┘
```

`AppViewModel` が状態の唯一の保持元です。`AppView` は MapLibre API を直接呼ばず、`MapAdapter` はフォームなどのDOMを直接操作しません。地域メッシュと Web Mercator の計算は副作用のない `MeshUtils` に分離しています。

## オーバーレイ

- 地域メッシュは地図ズームに応じて 4桁（9以下）、6桁（10〜13）、8桁（14〜15）、9桁（16）、10桁（17）、11桁（18以上）を使用します。
- 地域メッシュの広域生成は日本周辺（北緯20〜46度、東経122〜154度）に限定します。
- Web Mercator は現在ズームを整数に切り下げ、表示範囲の `z/x/y` タイルを算出します。
- 両者とも GeoJSON の線・面を MapLibre で描き、番号は外部フォント配信に依存しないDOMマーカーで表示します。
- 広域時は描画量を抑えるため番号ラベルを間引きます。中心地点の地域メッシュコードは常にサイドバーへ表示します。
- 表示範囲または表示切替が変わったときだけグリッドを更新し、通信統計など別の状態変更では再生成しません。
- 東京都の市区町村境界は `data/city_geojson/r2ka13_city.geojson` をGeoJSON sourceとして読み込み、MVTより前面の独立したline layerで表示します。

## MVT取得

取得ズームをz16とする設計理由、およびz12索引との役割分担は、[MVT 静的タイル索引と Three.js 統合](design/mvt-static-tile-index.md#41-z16を自治体判定mvt取得単位にする理由)を参照してください。z12は索引JSONの格納単位、z16は自治体判定とMVT取得の単位です。

- MapLibreのカスタムプロトコル `plateau-indexed://` を使用します。
- z16タイルごとにz12親索引を参照し、候補自治体コードが複数ある場合は全自治体のMVTを取得します。
- 土地利用と道路は自治体別のMapLibre vector sourceとして読み込み、索引で該当する複数自治体を重ねて表示します。
- 土地利用の `uro_orgLandUse` が「道路」の地物は、通常の土地利用と区別して橙色で表示します。3D Viewerも同じ属性規則をメッシュ生成時に適用します。
- z16未満ではMVTを要求せず、z16より拡大した場合はMapLibreのオーバーズームを利用します。

## 参照実装との関係

`docs/ref/geojson/js/geometric/japan-mesh-code.js` と `web-mesh-code.js` の計算方法を参照し、必要な処理だけを `web/viewers/maplibre/js/model/mesh-utils.js` に移植しています。実行時に `docs/ref/` は参照しません。
