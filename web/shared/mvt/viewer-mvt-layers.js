/**
 * 2D MapLibre / 3D Three 共通の MVT レイヤ定義（A.6）
 */

export const MVT_VIEWER_LAYERS = Object.freeze([
  Object.freeze({
    kind: 'luse',
    datasetId: 'luse-2025',
    label: '土地利用',
    code: 'luse',
    defaultVisible: true,
    defaultOpacity: 0.34,
    /** 道路用地ポリゴンだけ上書き（Three MVT） */
    roadFillOpacity: 0.68,
    dedupeOnDecode: true
  }),
  Object.freeze({
    kind: 'road',
    datasetId: 'tran-lod1-2025',
    label: '道路 LOD1',
    code: 'tran',
    defaultVisible: false,
    defaultOpacity: 0.72,
    /** tran はタイル内 gml_id マージを省略（頂点走査＋Line 本数削減はバッチ描画で対応） */
    dedupeOnDecode: false
  }),
  Object.freeze({
    kind: 'useDistrict',
    datasetId: 'use-district-2025',
    label: '用途地域',
    code: 'USE_DISTRICT',
    defaultVisible: false,
    defaultOpacity: 0.38,
    dedupeOnDecode: true
  })
]);

export function mvtLayerByKind(kind) {
  return MVT_VIEWER_LAYERS.find(layer => layer.kind === kind);
}

export function mvtLayerByDatasetId(datasetId) {
  return MVT_VIEWER_LAYERS.find(layer => layer.datasetId === datasetId);
}
