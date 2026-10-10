/** PoC 範囲・データセット定義（docs/design/mvt-static-tile-index.md） */
export const INDEX_REGIONS = Object.freeze([
  {
    id: 'kanto',
    label: '関東（東京・埼玉）',
    boundariesRelative: 'boundaries/kanto-cities.geojson',
    bounds: Object.freeze({
      north: 36.22,
      south: 35.53,
      west: 138.73,
      east: 139.91
    }),
    prefCodes: Object.freeze(['11', '13'])
  },
  {
    id: 'kyoto',
    label: '京都府',
    boundariesRelative: 'boundaries/kyoto-cities.geojson',
    bounds: Object.freeze({
      north: 35.785,
      south: 34.705,
      west: 134.853,
      east: 136.056
    }),
    prefCodes: Object.freeze(['26'])
  }
]);

/** 関東 PoC 矩形（後方互換・設計書の 154 親タイルはこの範囲） */
export const POC_BOUNDS = INDEX_REGIONS[0].bounds;

export const POC_PREF_CODES = Object.freeze(
  [...new Set(INDEX_REGIONS.flatMap(region => region.prefCodes))]
);
export const DATA_YEAR = 2025;

export const DATASETS = Object.freeze([
  {
    id: 'luse-2025',
    featureType: 'luse',
    catalogTypeEn: 'luse',
    lodSuffix: '',
    sourceLayer: 'luse',
    specSuffix: 'luse'
  },
  {
    id: 'tran-lod1-2025',
    featureType: 'tran',
    catalogTypeEn: 'tran',
    lodSuffix: '-lod1',
    sourceLayer: 'Road',
    specSuffix: 'tran-lod1'
  }
]);

export const INDEX_Z = 12;
export const FETCH_Z = 16;

/** `web/data` 配下の MVT 出力（manifest + index） */
export const MVT_OUTPUT_RELATIVE = 'mvt';

export const GEOJSON_BASE =
  'https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson';
