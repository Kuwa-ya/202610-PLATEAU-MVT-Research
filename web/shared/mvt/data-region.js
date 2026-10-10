/**
 * 実行時データは `web/data/`（配信時は `/data/...`）。
 * MVT 索引・manifest は `npm run build:mvt-index` で生成（Git では ignore）。
 *
 * Even G2 .ehpk は `base: './'` でビルドし、`index.html` 同階層の `data/mvt/` を参照する。
 * MapLibre 等（サイトルート配信）は従来どおり `/data/mvt`。
 */
let cachedMvtDataBase;

export function getMvtDataBase() {
  if (cachedMvtDataBase) return cachedMvtDataBase;
  const viteBase =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL;
  if (viteBase === './' && typeof document !== 'undefined' && document.baseURI) {
    cachedMvtDataBase = new URL('data/mvt/', document.baseURI).href.replace(/\/$/, '');
    return cachedMvtDataBase;
  }
  cachedMvtDataBase = '/data/mvt';
  return cachedMvtDataBase;
}

/** @deprecated 取得は {@link getMvtDataBase} を使う（G2 パックでは相対 URL） */
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
