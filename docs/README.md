# ドキュメント

このディレクトリには、調査結果、設計上の判断、検証手順を保存します。実行可能なWebアプリ本体は `web/` に分けます。

## 文書一覧

### 計画・現状

- [リポジトリ現状概要（ドキュメントベース）](repository-state-overview.md)  
  最終ゴール議論のたたき台。調査・設計・README から現在地と未決論点を整理したスナップショットです。

### 調査

- [PLATEAU 取得可能データ整理（Cesium 非採用）](research/plateau-data-availability.md)  
  公式配信データの種類、MVT の対応状況、非 Cesium 構成での利用方針を整理した調査記録です。
- [PLATEAU MVT の広域・連続利用における課題](research/mvt-wide-area-distribution-challenges.md)
  自治体別配信の重複、自治体コード指定、地域メッシュと Web Mercator タイルの不一致を整理しています。

### 設計

- [サイト構成](architecture.md)  
  Vanilla JSによるMVVMの責務分担、地図オーバーレイ、参照実装との関係をまとめています。
- [MVT 静的タイル索引と Three.js 統合](design/mvt-static-tile-index.md)  
  kuwaya-geo ベースでの z16 MVT 取得、z12 親 JSON 索引、東京都・埼玉県 PoC（154 ファイル）の設計です。実装は `tools/build-mvt-index/` と `web/viewers/three/`。
- [kuwaya-geo統合メモ](integration/kuwaya-geo.md)
  参照実装へMVT機能を統合する場合の接続点を整理しています。
- [MVTデコード・結合・重複排除設計](design/mvt-decode-merge-dedup.md)
  2D・3D共通のデコード方針、同一IDの結合、重複排除、利用ライブラリ、データフローを整理しています。

### 参照

- `ref/geojson/`  
  地域メッシュとWeb Mercatorタイル計算を移植する際に参照した既存ビューアです。サイトの実行時依存には含めません。

## 追加時のルール

- 継続更新する文書は、日付をファイル名に含めず Git 履歴で変更を追います。
- 特定時点のスナップショットであることが重要な場合だけ、本文とファイル名に日付を付けます。
- 外部 URL には、何を確認できるリンクなのかを併記します。

