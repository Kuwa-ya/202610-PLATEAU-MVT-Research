export const MVT_COLORS = Object.freeze({
  luseDefault: 0x47e6b1,
  luseRoad: 0xf59e48,
  lusePark: 0x40c98a,
  luseWater: 0x4ca9df,
  transport: 0xffc85a
});

const LUSE_ROAD_FILL_HEX = '#f59e48';

/**
 * 土地利用 MVT を「道路」として扱うか（2D MapLibre / 3D Three / Even G2 で共通の定義）。
 * 色付けは landUseColor / maplibreLuseFillColorExpression、論理判定はこの関数のみを使う。
 */
export function isLandUseRoad(properties = {}) {
  if (String(properties.uro_orgLandUse ?? '') === '道路') return true;
  return String(properties.luse_class ?? '').includes('道路用地');
}

/** MapLibre `fill-color` 用（選択ハイライトは呼び出し側で wrap） */
export function maplibreLuseFillColorExpression() {
  return [
    'case',
    ['any',
      ['==', ['get', 'uro_orgLandUse'], '道路'],
      ['>=', ['index-of', '道路用地', ['coalesce', ['to-string', ['get', 'luse_class']], '']], 0]
    ],
    LUSE_ROAD_FILL_HEX,
    ['match', ['get', 'uro_orgLandUse'],
      '公園', '#40c98a',
      '河川', '#4ca9df',
      '水面・河川・水路', '#4ca9df',
      '#47e6b1'
    ]
  ];
}

export function landUseColor(properties = {}) {
  if (isLandUseRoad(properties)) return MVT_COLORS.luseRoad;
  const usage = String(properties.uro_orgLandUse ?? '');
  if (usage.includes('公園')) return MVT_COLORS.lusePark;
  if (usage.includes('河川') || usage.includes('水面') || usage.includes('水路')) {
    return MVT_COLORS.luseWater;
  }
  return MVT_COLORS.luseDefault;
}

export function featureColor(datasetId, properties, fallbackColor) {
  return datasetId === 'luse-2025' ? landUseColor(properties) : fallbackColor;
}
