/**
 * 実行時データは `web/data/`（配信時は `/data/...`）。
 * MVT 索引・manifest は `npm run build:mvt-index` で生成（Git では ignore）。
 */
export const DATA_BASE = '/data/mvt';

export const BOUNDARY_LAYERS = Object.freeze([
  Object.freeze({
    id: 'kyoto',
    label: '京都府',
    url: '/data/boundaries/kyoto-cities.geojson',
    boundaryColor: '#7c3aed',
    dasharray: [2, 2]
  }),
  Object.freeze({
    id: 'kanto',
    label: '関東（東京・埼玉）',
    url: '/data/boundaries/kanto-cities.geojson',
    boundaryColor: '#f43f5e',
    dasharray: [3, 1.5]
  })
]);
