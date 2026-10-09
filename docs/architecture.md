# サイト構成

## 方針

サイトはビルド不要の Vanilla JS とし、拡張子 `.js` のブラウザ標準 ES Modulesでファイルを接続します。MVVM の責務ごとに `site/js/` 配下を1階層だけ分け、起動処理の `app.js` だけを直下に置きます。画面、地図ライブラリ、計算ロジックが互いの詳細を直接参照しない構成です。

## 責務

| ファイル | 区分 | 責務 |
|---|---|---|
| `model/model.js` | Model | 年度・自治体設定、入力検証、MVT URL、地物識別 |
| `model/mesh-utils.js` | Model | 地域メッシュと Web Mercator タイルの純粋計算 |
| `viewmodel/app-view-model.js` | ViewModel | 画面状態の唯一の保持元、操作による状態更新、変更通知 |
| `view/app-view.js` | View | DOMイベントを ViewModel に渡し、状態をDOMへ反映 |
| `services/map-adapter.js` | View Adapter | MapLibreの初期化、MVT・グリッド・ラベル描画、地図イベント通知 |
| `app.js` | Composition Root | 各要素の生成とコールバック接続。`site/js/` 直下に配置 |

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

## 参照実装との関係

`docs/ref/geojson/js/geometric/japan-mesh-code.js` と `web-mesh-code.js` の計算方法を参照し、必要な処理だけを `site/js/model/mesh-utils.js` に移植しています。実行時に `docs/ref/` を参照しないため、`site/` 単独で静的配信できます。
