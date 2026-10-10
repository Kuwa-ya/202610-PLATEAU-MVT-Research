/** ちずうつし本番と同じパス規則 */
export const BLDG_GEOJSON_ROOT = 'https://geo.kuwa-ya.co.jp/geojson-gzip';

export function bldgGeoJsonUrl(meshCode: string): string {
  return `${BLDG_GEOJSON_ROOT}/bldg/${meshCode.slice(0, 4)}/${meshCode.slice(4, 6)}/${meshCode.slice(6, 8)}/${meshCode}_bldg.geojson.gz`;
}
