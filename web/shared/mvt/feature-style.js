export const MVT_COLORS = Object.freeze({
  luseDefault: 0x47e6b1,
  luseRoad: 0xf59e48,
  lusePark: 0x40c98a,
  luseWater: 0x4ca9df,
  transport: 0xffc85a
});

export function landUseColor(properties = {}) {
  const usage = String(properties.uro_orgLandUse ?? '');
  if (usage === '道路') return MVT_COLORS.luseRoad;
  if (usage.includes('公園')) return MVT_COLORS.lusePark;
  if (usage.includes('河川') || usage.includes('水面') || usage.includes('水路')) {
    return MVT_COLORS.luseWater;
  }
  return MVT_COLORS.luseDefault;
}

export function featureColor(datasetId, properties, fallbackColor) {
  return datasetId === 'luse-2025' ? landUseColor(properties) : fallbackColor;
}
