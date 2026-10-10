/** 2D クリック／インスペクタ — レイヤ別の固定属性（codelist 変換なし） */

import {
  useDistrictCoveragePercent,
  useDistrictFloorAreaPercent,
  useDistrictLabel
} from './use-district.js';

function displayValue(raw) {
  if (raw === null || raw === undefined || raw === '') return '—';
  return String(raw);
}

/**
 * @param {'luse'|'road'|'useDistrict'} kind
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function inspectFieldsForLayerKind(kind, properties = {}) {
  if (kind === 'luse') {
    return [
      { key: 'luse_class', label: 'luse_class', value: displayValue(properties.luse_class) },
      { key: 'uro_orgLandUse', label: 'uro_orgLandUse', value: displayValue(properties.uro_orgLandUse) }
    ];
  }
  if (kind === 'road') {
    return [{ key: 'tran_function', label: 'tran_function', value: displayValue(properties.tran_function) }];
  }
  if (kind === 'useDistrict') {
    return [
      { key: 'urf_function', label: 'urf_function', value: displayValue(useDistrictLabel(properties)) },
      {
        key: 'urf_floorAreaRate',
        label: 'urf_floorAreaRate',
        value: formatOptionalPercent(useDistrictFloorAreaPercent(properties))
      },
      {
        key: 'urf_buildingCoverageRate',
        label: 'urf_buildingCoverageRate',
        value: formatOptionalPercent(useDistrictCoveragePercent(properties))
      }
    ];
  }
  return [];
}

function formatOptionalPercent(value) {
  if (value == null || value === '') return '—';
  return `${value}%`;
}

export function layerKindFromMapLayerId(layerId) {
  if (layerId.startsWith('luse-')) return 'luse';
  if (layerId.startsWith('useDistrict-')) return 'useDistrict';
  return 'road';
}

/** Three.js MVT タイル（datasetId）→ インスペクタ種別 */
/** G2 右テキスト等の1行要約（2D ポップアップと同系） */
export function formatLuseSummary(properties = {}) {
  const cls = displayValue(properties.luse_class);
  return `土地利用 ${cls}`;
}

export function layerKindFromDatasetId(datasetId) {
  if (datasetId === 'luse-2025') return 'luse';
  if (datasetId === 'use-district-2025') return 'useDistrict';
  if (String(datasetId ?? '').includes('tran')) return 'road';
  return 'luse';
}
