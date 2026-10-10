import { regionalMesh11 } from './mesh-code.js';

/** 11 桁地域メッシュ＝ちずうつし／Three 建物レイヤと同じ GeoJSON 1 ファイル単位 */
export function regionalBldgMeshKey(latitude: number, longitude: number): string {
  return regionalMesh11(latitude, longitude);
}

export function shouldFetchRegionalBldg(
  loadedMeshKey: string | null,
  latitude: number,
  longitude: number
): boolean {
  const next = regionalBldgMeshKey(latitude, longitude);
  return loadedMeshKey !== next;
}
