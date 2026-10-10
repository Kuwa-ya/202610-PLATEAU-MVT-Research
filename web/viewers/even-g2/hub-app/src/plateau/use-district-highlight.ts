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
