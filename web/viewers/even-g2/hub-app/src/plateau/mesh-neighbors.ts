import { meshBounds11, regionalMesh11, type RegionalMeshBounds } from './mesh-code.js';

/** 現在地の 11 桁メッシュ＋周囲 8 タイル（3×3） */
export function regionalMesh11Neighbors3x3(latitude: number, longitude: number): string[] {
  const centerCode = regionalMesh11(latitude, longitude);
  const cell = meshBounds11(centerCode);
  const midLat = (cell.south + cell.north) / 2;
  const midLon = (cell.west + cell.east) / 2;
  const h = cell.north - cell.south;
  const w = cell.east - cell.west;
  const codes = new Set<string>();
  for (const di of [-1, 0, 1]) {
    for (const dj of [-1, 0, 1]) {
      codes.add(regionalMesh11(midLat + di * h, midLon + dj * w));
    }
  }
  return [...codes];
}

export function unionMeshBounds(codes: string[]): RegionalMeshBounds {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const code of codes) {
    const b = meshBounds11(code);
    south = Math.min(south, b.south);
    west = Math.min(west, b.west);
    north = Math.max(north, b.north);
    east = Math.max(east, b.east);
  }
  if (!Number.isFinite(south)) {
    return { south: 0, west: 0, north: 0, east: 0 };
  }
  return { south, west, north, east };
}
