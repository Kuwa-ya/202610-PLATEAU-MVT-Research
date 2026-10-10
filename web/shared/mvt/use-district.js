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

/** MVT 用途地域（urf:UseDistrict / 内部 USE_DISTRICT）の表示用 */

export const USE_DISTRICT_DATASET_ID = 'use-district-2025';

export const USE_DISTRICT_SOURCE_LAYER = 'UseDistrict';

/** MapLibre `fill-color`（選択ハイライトは呼び出し側で wrap） */
export function maplibreUseDistrictFillColorExpression() {
  return [
    'match',
    ['get', 'urf_function'],
    '商業地域', '#e879f9',
    '近隣商業地域', '#f0abfc',
    '第１種住居地域', '#60a5fa',
    '第２種住居地域', '#38bdf8',
    '第１種低層住居専用地域', '#4ade80',
    '第２種低層住居専用地域', '#86efac',
    '準住居地域', '#a5b4fc',
    '工業地域', '#fb923c',
    '工業専用地域', '#fdba74',
    '#c4b5fd'
  ];
}

export function useDistrictLabel(properties = {}) {
  return String(properties.urf_function ?? properties['urf:function'] ?? '用途地域');
}

export function useDistrictCoveragePercent(properties = {}) {
  const raw = properties.urf_buildingCoverageRate ?? properties['urf:buildingCoverageRate'];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function useDistrictFloorAreaPercent(properties = {}) {
  const raw = properties.urf_floorAreaRate ?? properties['urf:floorAreaRate'];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** インスペクタ・G2 向けの短い 1 行サマリ */
export function formatUseDistrictSummary(properties = {}) {
  const name = useDistrictLabel(properties);
  const cov = useDistrictCoveragePercent(properties);
  const far = useDistrictFloorAreaPercent(properties);
  const parts = [name];
  if (cov != null) parts.push(`建ぺい ${cov}%`);
  if (far != null) parts.push(`容積 ${far}%`);
  return parts.join(' · ');
}
