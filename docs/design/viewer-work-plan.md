# 2D / 3D / Even G2 — 作業計画（2026-10）

Even G2 を主成果物とし、2D MapLibre を検証基盤、3D Three を条件付きで維持する前提の **未着手・進行中タスク** をまとめる。  
合意の全体像は [pre-dev-agreement.md](../pre-dev-agreement.md)、必達の整理は [architecture_new.md](../architecture_new.md) を参照。

> **`presentation/` フォルダは編集しない**（他者調整中の全体説明）。G2 右画面・住所・モバイル UI は [g2-display-and-address.md](./g2-display-and-address.md) を正とする。

## 完了済み（参考・この文書のスコープ外）

| 項目 | メモ |
| --- | --- |
| 京都 z16 ゲート | [kyoto-z16-gate.md](./kyoto-z16-gate.md)、`npm run verify:kyoto-z16-gate` |
| G2 用途地域タップ・索引同梱・域内建物クリップ | [use-district-clip-g2.md](./use-district-clip-g2.md) |
| Ortho 第一版 | 2D/3D 既定を PLATEAU Ortho 2023 に変更済み（**本計画で切替 UI 等を拡張**） |
| codelist 変換 | スコープ外（MVT 直読み） |
| **F** G2 右画面・16 方位・住所 r2ka26・phone UI・address pack | [g2-display-and-address.md](./g2-display-and-address.md) |
| 2D 背景 3 切替・A.3/A.5/A.7（一部） | 2026-10-11 着手（本節 A に残りあり） |
| **A** 2D/3D UI 調整一式 | 2026-10-11 — 下記「A 完了メモ」 |
| Three MVT ポリゴンリング | [three-mvt-polygon-rings.md](./three-mvt-polygon-rings.md) |

### A 完了メモ（2026-10-11）

| 項 | 実装 |
| --- | --- |
| A.1 | `web/shared/geo/viewer-theme.css` — **白背景** + ちずうつし系 **赤アクcent**（UI）。地物スウォッチ色は MVT 表示色 |
| A.2 | 2D `#basemap-select` + `plateau-basemap.js`；3D `#texture-type` 3 種（既存） |
| A.3 | 自動タイル選択 UI 削除済み |
| A.4 | `rendered-feature-dedup.js` + MapLibre 検証トグル |
| A.5 | `feature-inspect.js` — インスペクタ／ポップアップ共通 |
| A.6 | `viewer-mvt-layers.js` + 2D/3D 共通 **トoggle のみ**（`button.layer-switch`、透明度 UI なし・既定 opacity はコード内） |
| A.7 | 建物表記 LOD1 相当（Three `index.html`） |
| A.8 | Three 住所検索（`address-geocode.js` → ちずうつし API）、旧ビューリセットボタン削除 |

---

## A. 2D / 3D 調整（雑多だが横断）— 完了

### A.1 UI の色味

| 項目 | 内容 |
| --- | --- |
| 方針 | [ちずうつし（kuwaya-geo）](https://geo.kuwa-ya.co.jp/) のトーンに **寄せる** |
| 差分 | ちずうつし本番は **黒基調**、本研究ビューアは **白基調**（明るい背景・パネル） |
| 対象 | MapLibre LAB（`web/viewers/maplibre/`）、Three PoC（`web/viewers/three/`）、必要なら G2 周辺の説明 UI |

### A.2 地表テクスチャ（Ortho / 地理院）

| 項目 | 内容 |
| --- | --- |
| 背景 | PLATEAU Ortho は **配信範囲が一部のみ** のため、全域で単独 Ortho にはできない |
| 方針 | **3D のちずうつし型タイル切替**に合わせ、次の 3 種を **ユーザーが選択**できるようにする（2D ラスタ底图も同様） |
| 選択肢 | ① 地理院 **標準地図**（`std`） ② 地理院 **航空写真**（シームレス写真等） ③ **PLATEAU Ortho**（例: `plateau-ortho-2023`） |
| 実装メモ | 共有定義: `web/shared/geo/plateau-basemap.js`（拡張）。3D: `docs/ref/kuwaya-geo/js/domain/terrain.js` の `textureType`。2D: MapLibre `style.sources` の差し替え |

### A.3 2D パネル整理

| 項目 | 内容 |
| --- | --- |
| 削除 | サイドバー **「自動タイル選択」** セクション（大手町・神田・霞が関チップ等）— 用途が分かりにくいため |
| 残す | レイヤートグル、読み込み状況、インスペクタ、必要なら地点移動は **別 UI**（住所検索等）に統合 |

### A.4 タイル上の複数自治体表示

| 項目 | 内容 |
| --- | --- |
| 対象 | Web Mercator / MVT デバッグ用パネルで **タイルに紐づく自治体コード一覧** を出している部分 |
| ルール | 地物の **`gml_id` / `mvt_id`** が同一のものは **1 件のみ**（クリック照会・重なり解決）。**ジオメトリ一致ではグループ化しない** |
| 優先 | 同一 ID が複数自治体ソースから来る場合、**ポリゴン頂点数が多い**（欠落が少ない）方を残す — `web/shared/mvt/rendered-feature-dedup.js` |
| 備考 | ID 無し feature のみジオメトリ署名で区別 |

### A.5 クリック時ポップアップ（地図上）

レイヤ種別ごとに **表示する属性を固定**する（codelist 変換なし・文字列／数値の直読み）。

| レイヤ | 表示属性（MVT フラット名） |
| --- | --- |
| 土地利用 `luse` | `luse_class` |
| 道路 `tran`（tran-lod1） | `tran_function` |
| 用途地域 `urf` / USE_DISTRICT | `urf_function`、`urf_floorAreaRate`、`urf_buildingCoverageRate` |

※ インスペクタ右パネル・MapLibre ポップアップの両方をこのセットに揃える。

### A.6 MVT レイヤ UI の共通化

| 項目 | 内容 |
| --- | --- |
| ゴール | **2D と 3D で同じ考え方**のレイヤ UI |
| 見た目 | 3D のように **簡素**（項目数を絞る） |
| 操作 | **トoggle のみ**（ON/OFF が一目で分かる。透明度は固定値） |
| レイヤセット | 土地利用 / 道路（定義は `uro_orgLandUse === "道路"` 側の luse 道路）/ 用途地域（＋将来 Even 用の地面・道路メッシュ） |

### A.7 3D 表記修正

| 項目 | 内容 |
| --- | --- |
| 修正 | パネル・README の **「建物 LOD2」** 等 → 実態は **kuwa-ya GeoJSON（LOD1 相当）** に合わせた表記 |
| 対象 | `web/viewers/three/index.html` ほか |

### A.8 3D ビュー操作

| 項目 | 内容 |
| --- | --- |
| 削除・置換 | 現状の **「カメラを原点へ戻す」「MVT 表示距離まで寄る」** 等、用途不明なボタン |
| 代替 | **ちずうつしと同型の住所検索**（ジオコーディング → カメラ移動・原点更新） |
| 参照 | `docs/ref/kuwaya-geo/` の住所検索 UI / API 利用パターン |

---

## B. 大型追加（3D / Even 共通を意識）

### B.1 Even G2 — 地形ポリゴン（地面メッシュ）

| 項目 | 内容 |
| --- | --- |
| 目的 | 建物だけでなく **地面**を G2 斜め俯瞰に載せ、道路・現在地との **明暗バランス**を取る |
| 座標系 | 基本 **Web Mercator**（建物 GeoJSON の EN 変換と整合） |
| 範囲 | 建物より **広い**。**現在点中心の 9 タイル**（3×3） |
| ズーム基準 | **z17 を基準**（取得・解像度の目安。実装時に DEM/テクスチャの maxzoom と突合） |
| 描画方針（第一候補） | **航空写真テクスチャ**を地面メッシュに貼り、見た目を確認 → 問題なければ採用 |
| フォールバック | テクスチャが不十分なら **凹凸（標高）のみ**、または簡略シェーディング |
| 関連 | ちずうつし DEM タイルローダー、G2 の 288×144・北上固定カメラ |

### B.2 LandUse「道路」— 地面への投影（3D / Even 共通）

| 項目 | 内容 |
| --- | --- |
| 対象 | `uro_orgLandUse === "道路"`（および luse 上の道路用地）に該当する **ポリゴン** |
| ゴール | MVT 2D ポリゴンを **起伏付き地面に沿わせて**描画（ダレ着きではなく地面と同高さベース） |
| 第一案 | ① 地面メッシュ／標高グリッドで **対象範囲を切り出し** ② 外周頂点の高さを **近傍標高から算定** ③ 内部は **地面と同高**でポリゴン（交点は **配列データから**求め、3D エンジン交点 API に依存しない） |
| 簡略案 | より単純な **頂点ごと DEM サンプル＋三角分割** で足りればそちらを採用 |
| Even G2 | 道路が **やや強調**される色・コントラスト。**現在地 ＞ 道路 ＞ 建物** の明暗順 |

### B.3 3D 用途地域の描画

| 項目 | 内容 |
| --- | --- |
| 優先 | B.2 と同様の **軽量な地面追随**（可能なら） |
| フォールバック | 不可なら、**表示中地形の最大標高 + 約 1 m** の高さに **フラット**表示（重なり回避） |
| 2D | 既存 MVT 半透明＋タイルクリップを維持 |

### B.4 LandUse クリック → 交差 UseDistrict のピックアップ（2D / 3D）

| 項目 | 内容 |
| --- | --- |
| トリガ | **土地利用**ポリゴンをクリック選択 |
| 処理 | 選択ポリゴンと **幾何交差**する **USE_DISTRICT** を抽出（**0 / 1 / 複数**） |
| 表示 | 用途地域ごとに **種別・建ぺい率・容積率**（A.5 の urf 属性）を一覧 |
| 地図 | ピックアップされた UseDistrict を **強調表示**（単数／複数） |
| G2 | 現状は「現地点 in ポリゴン」— 本項は **2D/3D インスペクタ**中心。G2 への展開は別途 |

---

## F. Even G2 — 右画面メイン情報・住所・モバイル UI

詳細は **[g2-display-and-address.md](./g2-display-and-address.md)**。

| 項目 | 概要 |
| --- | --- |
| G2 右テキスト | 標高、緯度経度、GPS 差分の **16 方位**、住所（市区町村＋町丁目）、**タップ時**用途地域 3 属性 |
| G2 から除外 | メッシュ・面数・SDK/perf・カメラ等 → **モバイルのみ** |
| モバイル UI | 上: シミュレータ風 **黒背景・グリーン**の大プレビュー / 下: 現状の詳細 |
| 住所 | `docs/ref/` の city → **市区町村コード別 chome 分割**を lazy load（§4.2） |

---

## C. 実装順序（提案）

| 順 | ブロック | 理由 |
| --- | --- | --- |
| 0 | **F**（G2 右テキスト再構成・16 方位・phone レイアウト） | 主成果物の情報設計 |
| 0b | **F + 住所分割** | city 索引 + chome lazy load（pack / `/data/address/`） |
| 1 | ~~**A**~~ | 完了（上記メモ） |
| 2 | **B.1** G2 地面 9 タイル | 道路・建物バランスの前提 |
| 3 | **B.2** 道路ドレープ | B.1 に依存 |
| 4 | **B.3** 用途地域 3D | B.1/B.2 のパターン流用 |
| 5 | **B.4** luse → urf 連動 | 2D/3D 共有ジオメトリ＋索引 |

---

## D. 関連パス・コマンド

| 種別 | パス / コマンド |
| --- | --- |
| 2D | `web/viewers/maplibre/` |
| 3D | `web/viewers/three/` |
| G2 | `web/viewers/even-g2/hub-app/` |
| 共有 MVT | `web/shared/mvt/` |
| 索引生成 | `npm run build:mvt-index`、`npm run build:mvt-index:use-district` |
| 京都ゲート | `npm run verify:kyoto-z16-gate` |

---

## E. 更新ルール

- タスク完了時は本ファイルの該当行を **完了済み**セクションへ移すか、チェックを `[x]` に更新する。
- 仕様が固まった部分は `design/*.md` に **詳細設計**を切り出してよい（例: 道路ドレープのみ別紙）。

| 日付 | 変更 |
| --- | --- |
| 2026-10-10 | 初版（2D/3D 調整 + B 大型項目） |
| 2026-10-11 | F 完了反映。A 一式完了（`viewer-mvt-layers.js`、Three 住所検索、テーマ CSS） |
