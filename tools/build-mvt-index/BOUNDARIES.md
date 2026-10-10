# 行政界によるz16索引絞り込み

## 入力と配置

- 共有原本: `data/city_geojson/r2ka13_city.geojson`
- 交差判定: `admin-boundaries.js`
- 索引生成: `build.js`
- 単体確認: `scripts/check-admin-boundaries.js`

大容量GeoJSONを`web/`と`tools/`へ二重配置しない。開発サーバーは`data/`を`/data`へマウントするため、Viewer表示とビルド入力で同じ原本を利用できる。

## 採用するタイル

次のいずれかを満たすz16タイルを自治体の対象とする。

1. タイルの角が行政界Polygonの内部にある。
2. 行政界Polygonの頂点がタイル内部にある。
3. タイル辺と行政界の線分が接触または交差する。

Polygonの穴に完全に含まれるタイル、bboxだけが重なる行政界外タイルは除外する。bboxは高速な事前絞り込みとしてのみ使用する。

## 再生成

既存manifestとカタログsnapshotを使って索引だけを再生成する。

```powershell
npm.cmd run build:mvt-index:offline
```

交差判定だけを確認する。

```powershell
npm.cmd run check:boundaries
```

生成索引はスパース形式とし、該当自治体がないz16キーは出力しない。東京都は実ポリゴン判定、未収録の埼玉県はbboxフォールバックである。
