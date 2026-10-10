// @ts-expect-error リポジトリ内 JS（型定義なし）
import { MeshUtils } from '../../../../maplibre/js/model/mesh-utils.js';

export type RegionalMeshBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export function regionalMesh11(latitude: number, longitude: number): string {
  return MeshUtils.meshCodeFromLatLon(latitude, longitude, 11);
}

export function meshBounds11(meshCode: string): RegionalMeshBounds {
  const b = MeshUtils.meshBounds(meshCode);
  return { south: b.south, west: b.west, north: b.north, east: b.east };
}
