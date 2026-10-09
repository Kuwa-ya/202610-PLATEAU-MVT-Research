/** PoC 範囲・データセット定義（docs/design/mvt-static-tile-index.md） */
export const POC_BOUNDS = Object.freeze({
  north: 36.22,
  south: 35.53,
  west: 138.73,
  east: 139.91
});

export const POC_PREF_CODES = Object.freeze(['11', '13']);
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

export const GEOJSON_BASE =
  'https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson';
