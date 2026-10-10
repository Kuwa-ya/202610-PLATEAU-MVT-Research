# kuwaya-geo への MVT 統合メモ

`docs/ref/kuwaya-geo` は Kuwa-ya 社製「ちずうつし」の参照実装です。**本リポジトリは Kuwa-ya 社（代表者）による研究用**であり、ここでの改変・統合・派生は権限のもと進めます。

[`SOURCE-CODE-LICENSE.txt`](../../docs/ref/kuwaya-geo/legal/SOURCE-CODE-LICENSE.txt) の制限は、**第三者**が Software を利用・改変する場合に適用されます。

当面は [`web/viewers/three/`](../../web/viewers/three/) にMVT索引ロジックを実装しています。kuwaya-geo本体へ載せる場合の接続点は次のとおりです。

| kuwaya-geo | MVT 統合 |
| --- | --- |
| `lod.js` / `settingForDistance` | `BUILDING_MIN_LOD` / `TRANSPORT_MIN_LOD`（16）以上で [`mvt-controller.js`](../../web/viewers/three/js/services/mvt-controller.js) の `sync()` |
| `terrain-controller.js` の `moveend` 相当 | カメラ更新後に MVT sync |
| `selection-controller.js` / エクスポート | 設計書 §10.4: MVT 閾値未満では不可（メッセージ） |
| 静的データ | リポジトリ `data/manifest` + `data/index` |

索引ローダーは [`mvt-index.js`](../../web/viewers/three/js/services/mvt-index.js) をES moduleとして再利用できます。
