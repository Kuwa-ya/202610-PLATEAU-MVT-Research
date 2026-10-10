/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

export const MVT_COLORS = Object.freeze({
  luseDefault: 0x47e6b1,
  luseRoad: 0xea9a42,
  lusePark: 0x40c98a,
  luseWater: 0x4ca9df,
  transport: 0xea9a42,
  useDistrict: 0xc084fc
});

/** 濃さの優先: 現在地マーカー > 道路（luse 道路用地・tran）> 建物 */
export const VIEWER_VISUAL = Object.freeze({
  buildingColor: 0xc8cdc9,
  buildingOpacity: 0.28,
  roadColor: 0xea9a42,
  roadOpacityG2: 0.68,
  roadOpacityMvtLine: 0.72,
  luseFillOpacity: 0.34,
  userMarkerRingColor: 0x66d4ff,
  userMarkerRingOpacity: 0.95
});

const LUSE_ROAD_FILL_HEX = '#ea9a42';

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
  if (datasetId === 'luse-2025') return landUseColor(properties);
  if (datasetId === 'use-district-2025') return MVT_COLORS.useDistrict ?? fallbackColor;
  return fallbackColor;
}
