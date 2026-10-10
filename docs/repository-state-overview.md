# リポジトリ現状概要（ドキュメントベース）

本書は **既存ドキュメントとルート README の整理のみ** に基づくスナップショットです。コードの詳細実装は参照しません。最終ゴールの議論のたたき台として使い、差分は Git で追います。

- 作成目的: 現在地の共有と、ゴール設定ワークの起点
- 一次情報: [ルート README](../README.md)、[docs/README.md](README.md) および下表の各文書

---

## 1. プロジェクトの位置づけ

| 項目 | 内容（文書上の整理） |
| --- | --- |
| 名称 | PLATEAU MVT Research（`plateau-mvt-research`） |
| 一言 | PLATEAU が配信する **自治体別 MVT** を、ビルド不要の静的 Web で **2D（MapLibre）・3D（Three.js）** から検証する研究用リポジトリ |
| 技術方針 | **Cesium / 3D Tiles は採用しない**（[調査: plateau-data-availability](research/plateau-data-availability.md)） |
| 参照実装 | **kuwaya-geo（ちずうつし）** を 3D・LOD の思想のベース（[設計: mvt-static-tile-index](design/mvt-static-tile-index.md)、[統合メモ](integration/kuwaya-geo.md)） |
| 利用者文脈 | Kuwa-ya 社製参照実装の研究・統合検討（ライセンスは `docs/ref/kuwaya-geo/legal/`） |

---

## 2. 解いている問題（調査・設計の共通認識）

[広域利用の課題整理](research/mvt-wide-area-distribution-challenges.md) では、自治体別 MVT を「境界を意識しない連続地図」として使う際の論点を次の3点に集約している。

1. **自治体間で同一地物が重複**（`gml_id` や形状の二重取得・二重描画・集計の誤り）
2. **自治体コードの事前指定**が必要で、パンに追従する広域表示が難しい
3. **地域メッシュ（原典所属）** と **Web Mercator タイル（通信単位）** が一致しない

本リポジトリの PoC は、とくに (2) を **静的タイル索引** で緩和し、(1) は **重ね描画＋暫定重複抑制** から **[結合・重複排除設計](design/mvt-decode-merge-dedup.md)** へ段階移行する想定で整理されている。

---

## 3. 現状の成果物（何が動く想定か）

### 3.1 実行形態

- **Vanilla JS + ES Modules**、Web 配信ルートは `web/`（[architecture.md](architecture.md)）
- 開発: `npm run dev` → 既定 `http://127.0.0.1:4173/`（`PORT` / `HOST` 可変）。入口は `scripts/dev.js`（ポート解放後に `scripts/serve.js` を起動）
- 品質: `npm run check`（構文・メッシュ・索引関連の既知テスト）

### 3.2 Viewer

| Viewer | パス | 役割（README・設計書） |
| --- | --- | --- |
| 入口 | `web/index.html` | 2D / 3D の選択 |
| 2D | `web/viewers/maplibre/` | MVVM + MapLibre。カスタムプロトコル `plateau-indexed://` で z16 MVT を索引解決 |
| 3D | `web/viewers/three/` | kuwaya-geo 系の地形 PoC + MVT コントローラ。カメラ距離 LOD と連動 |
| 共通 | `web/shared/mvt/` | スタイル等の Viewer 共通 MVT 処理 |

### 3.3 データセット・地理範囲（PoC）

- **年度・地物**: 2025 年度の **土地利用 `luse`** と **道路 `tran-lod1`**（設計書 §13）
- **空間範囲**: **東京都＋埼玉県** の外接矩形。z12 親索引 JSON **154 件**（[data/README.md](../data/README.md)、[build-mvt-index README](../tools/build-mvt-index/README.md)）
- **取得ズーム**: 実運用は TileJSON の **`maxzoom`（調査上は多くが 16）** のみ。z10〜15 の MVT は **非読込・非表示**（設計 §3.2）
- **索引の役割**: z12 は **JSON の格納・キャッシュ単位**、z16 は **自治体候補判定・MVT 取得単位**（設計 §4.2）

### 3.4 地図上の補助レイヤ（機能一覧の要約）

ルート README に記載の検証用オーバーレイ:

- 地域メッシュ（ズームに応じた桁切替・コード表示）
- Web Mercator タイル境界・`z/x/y`（初期オフ）
- タイル番号への **取得先自治体コード** の併記
- 東京都市区町村境界（`data/city_geojson/r2ka13_city.geojson`）の比較用ライン
- 土地利用の `uro_orgLandUse === "道路"` の **橙色** ハイライト（2D・3D 共通）

初期表示は **東京駅周辺**。自治体コードの手入力は不要（索引から自動選択）。

### 3.5 ローカルデータと外部依存

| 種別 | 配置・取得 |
| --- | --- |
| 静的索引 | `data/manifest/`、`data/index/{dataset}/12/{x}/{y}.json`（ビルド生成） |
| カタログスナップショット | `data/snapshot/`（ビルド時） |
| MVT 本体・背景地図 | **表示時に PLATEAU 等の外部配信**（オフライン単体では完結しない） |
| ライブラリ同梱 | MapLibre GL JS 5.24.0、`three@0.185.1`、`@mapbox/vector-tile` + `pbf`（npm → `/vendor` 配信） |

索引ビルド: `npm run build:mvt-index`（設計 [mvt-static-tile-index.md](design/mvt-static-tile-index.md)）。

---

## 4. アーキテクチャの要点（2D）

[architecture.md](architecture.md) の責務分担:

- **AppViewModel** が画面状態の唯一の保持元
- **MapAdapter** が MapLibre とオーバーレイ描画
- **indexed-mvt-protocol** が z16 タイル → 自治体別 MVT URL 解決
- メッシュ・Web Mercator 計算は **MeshUtils**（`docs/ref/geojson` の geometric を移植。実行時は `docs/ref` 非依存）

3D は kuwaya-geo の LOD・地形フローに **MVT sync** を差し込む形で設計（[integration/kuwaya-geo.md](integration/kuwaya-geo.md)）。

---

## 5. 実装済み・要検証・未対応（設計書 §11 の写し）

出典: [mvt-static-tile-index.md §11](design/mvt-static-tile-index.md#11-実装状況と次の検証)

| 区分 | 内容 |
| --- | --- |
| **実装済み** | 東京都・埼玉の manifest と z12 親索引の生成 |
| **実装済み** | z16 タイルから関係する全自治体を解決する共通規則 |
| **実装済み** | Three.js 版の MVT 取得・デコード・タイル範囲クリップ |
| **実装済み** | MapLibre 版のカスタムプロトコル、z16 取得、z17+ オーバーズーム |
| **実装済み** | タイル番号と土地利用・道路それぞれの取得先自治体コード表示 |
| **要検証** | 複数自治体 MVT 重ね合わせ時の同一地物・境界差の確認 |
| **要検証** | 都県境を含む代表地点で 2D・3D の取得自治体・描画の一致 |
| **要検証** | 非表示中の移動・再表示・連続パンで古い非同期結果が混入しないか |
| **未対応** | 低ズーム時の MVT 選択・ダウンロード可否（設計 §10.4） |

---

## 6. MVT 処理の「今」と「次」（重複・結合）

[mvt-decode-merge-dedup.md](design/mvt-decode-merge-dedup.md) の段階整理:

| レベル | 状態（文書上） |
| --- | --- |
| 重ね描画 | **現在の実装**。自治体別 MVT を個別に取得・描画 |
| 重複排除 | 2D は表示上の暫定抑制の記述あり（広域課題文書 §3.3）。本格的な **Worker + 形状ハッシュ** は設計段階 |
| 結合（タイル境界の union） | **次段階の実装対象**。`polygon-clipping` 等を想定 |

設計上の完了条件（§9）例: 同一 `gml_id` の完全重複が1回だけ描画、タイル分割の union、2D/3D で同一件数、非同期の世代管理。

実装段階のロードマップは同文書 **§8**（共通 Feature 形式 → fixture テスト → 3D 先行 → 2D を GeoJSON source 経路へ、など）。

---

## 7. 明示的にスコープ外（現フェーズ）

設計 [mvt-static-tile-index.md §3.2](design/mvt-static-tile-index.md#32-やらないこと本フェーズ) および調査方針から:

- CityGML と MVT の精度突合・算定用途の原典保証
- 全国索引の本番運用（PoC は都県矩形。スキーマは全国拡張可能と記載）
- 統合 PMTiles の事前生成（将来案）
- 建築物の公式 MVT（無し → CityGML 自前変換が別線、[plateau-data-availability](research/plateau-data-availability.md)）

---

## 8. ドキュメント・参照コードの地図

| 種別 | パス | 用途 |
| --- | --- | --- |
| 調査 | `docs/research/` | 配信データ整理、広域 MVT 課題 |
| 設計 | `docs/design/` | 静的索引、デコード・結合・重複排除 |
| 構成 | `docs/architecture.md` | 2D MVVM・オーバーレイ・MVT 取得 |
| 統合 | `docs/integration/kuwaya-geo.md` | 参照実装への接続点 |
| 参照（非実行） | `docs/ref/geojson/` | メッシュ計算の移植元 |
| 参照（非実行） | `docs/ref/kuwaya-geo/` | 3D・LOD・UI のベース |
| 索引ビルド | `tools/build-mvt-index/` | カタログ → manifest / z12 JSON |
| スクリプト | `scripts/` | 開発サーバー、check 系 |

---

## 9. リスク・運用上の注意（設計書から）

[mvt-static-tile-index.md §12](design/mvt-static-tile-index.md#12-リスクと対応) の要約:

- カタログ・TileJSON 更新 → **索引ビルドの再実行**
- 境界タイルでの **複数 MVT 同時取得** の通信・描画負荷
- 土地利用 z16 タイルの **サイズ** → 同時 fetch 上限・キャッシュ
- kuwaya-geo ソースの **利用条件** の遵守

---

## 10. ゴール設定ディスカッション用の未決・分岐（文書から抽出）

最終ゴールを決めるとき、既存文書が示す **選択肢・未記入** は次のようなものである（ここから合意形成する想定）。

1. **プロダクト形態**: 独立 PoC（現 `web/viewers/`）の完成度を上げるか、**kuwaya-geo 本体への統合**まで含めるか（[integration/kuwaya-geo.md](integration/kuwaya-geo.md)）
2. **地理・データの拡張**: 都県 PoC の先に **全国索引**、追加地物型（`urf` 等 MVT あり）、年度変更の扱い
3. **重複・結合の深さ**: 重ね描画＋暫定抑制で十分か、[mvt-decode-merge-dedup.md](design/mvt-decode-merge-dedup.md) §9 の **完了条件** まで必達か
4. **主 Viewer**: 2D 検証中心、3D（地形＋MVT）中心、または **両方の一致** をゴールに含めるか（設計 §11 の要検証項目）
5. **運用・配布**: 静的ホストのみか、索引 CI、オフライン索引ビルド（`build:mvt-index:offline`）の位置づけ
6. **キボミル等の業務ゴール**: [plateau-data-availability](research/plateau-data-availability.md) は「表示は MVT、算定は CityGML 比較」を強調 — 本リポジトリのゴールに **算定・選択** を含めるかは別決定

---

## 11. 次のステップ（本概要の使い方）

1. 上記 **§10** について、期日・必達・Nice-to-have を分けて最終ゴール文を1段落＋箇条書きで起こす
2. ゴールと [mvt-static-tile-index §11](design/mvt-static-tile-index.md#11-実装状況と次の検証)・[mvt-decode-merge-dedup §8–9](design/mvt-decode-merge-dedup.md#8-実装段階) のギャップを表にする
3. 必要なら `docs/` に **goal.md**（または日付付きスナップショット）を追加し、本概要からリンクする

---

## 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-10-10 | 初版。既存 docs / README の要約のみ |
