# 住所 GeoJSON（参照データ）

G2 現在地ラベル用の **正本**は `docs/ref/` 直下の GeoJSON。  
配信用の分割結果は **`web/data/address/`**（Git ignore、`npm run build:address-pack` で再生成）。

設計: [g2-display-and-address.md](../design/g2-display-and-address.md)

---

## ファイルと役割（r2ka スキーマ）

京都・東京とも **住基町丁目・字等（r2ka）** 形式。属性は `PREF` / `CITY` / `PREF_NAME` / `CITY_NAME` / `S_NAME` 等（東京都 `r2ka13` と同型）。

| 地域 | 市区町村 | 町丁目（細域） | 市区町村コード |
| --- | --- | --- | --- |
| 京都府 | `r2ka26_city.geojson` | `r2ka26_convert.geojson` | `PREF` + `CITY`（3 桁）例: `26106` |
| 東京都 | `r2ka13_city.geojson` | `r2ka13_convert.geojson` | 同上 例: `13101` |

ビルド: `scripts/build-address-pack.js` の `DATASETS`。

**旧 N03 系（`N03-21_26_210101_*`）は使用しない。** リポジトリから削除済み想定。

---

## 更新手順

1. `docs/ref/` の該当 GeoJSON を差し替え（ファイル名変更時は `DATASETS` を更新）。
2. ルートで `npm run build:address-pack`（または `npm run build:even-g2`）。
3. 表示確認（京都駅付近など）。`S_NAME` が null の feature は市区町村名まで。

**Git**

- **含める**: `docs/ref/r2ka*.geojson`（正本）
- **含めない**: `web/data/address/**`（生成物。`.gitkeep` のみ）

---

## 再生成コマンド

```bash
npm run build:address-pack    # web/data/address のみ
npm run build:even-g2         # address 生成 + MVT 同期 + Vite 本番ビルド
```

Even `.ehpk` では **city 索引 + chome パック** が同梱必須（無いとランタイムで住所 fetch が失敗する）。
