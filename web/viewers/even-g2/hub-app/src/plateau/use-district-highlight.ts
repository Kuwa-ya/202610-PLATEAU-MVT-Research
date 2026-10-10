/*!
 * PLATEAU MVT Research — TypeScript source module
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

// @ts-expect-error 共有 MVT クエリ（JS）
import { queryUseDistrictAtLonLat } from '../../../../../shared/mvt/use-district-query.js';

export type UseDistrictHighlight = {
  properties: Record<string, unknown>;
  /** 外環 [lon, lat] */
  ring: Array<[number, number]>;
  summary: string;
  sourceLayer: string;
};

export async function fetchUseDistrictHighlight(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<UseDistrictHighlight | null> {
  const hit = await queryUseDistrictAtLonLat(latitude, longitude, { signal });
  if (!hit) return null;
  return {
    properties: hit.properties,
    ring: hit.ring as Array<[number, number]>,
    summary: hit.summary,
    sourceLayer: hit.sourceLayer
  };
}
