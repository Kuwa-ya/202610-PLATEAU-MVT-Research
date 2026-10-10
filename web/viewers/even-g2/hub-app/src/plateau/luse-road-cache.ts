/*!
 * PLATEAU MVT Research — Even G2 luse 道路用地 MVT キャッシュ
 *
 * ポリゴンは経緯度で保持し、描画時に **現在地** を原点として EN 再投影する（建物 GeoJSON と同じ）。
 */

import * as THREE from 'three';
import { regionalBldgMeshKey, shouldFetchRegionalBldg } from './mesh-data-key.js';
// @ts-expect-error shared JS
import { createGsiDemPointSampler } from '../../../../../shared/geo/gsi-dem-point-sampler.js';
// @ts-expect-error shared JS
import { fetchLuseRoadPolygonsNear } from '../../../../../shared/mvt/luse-road-near.js';

/** G2 は Three PoC の +2 m 浮上を使わない（地面追随 + わずかなオフセット） */
export const G2_ROAD_SURFACE_OFFSET_M = 0.12;

/** 道路メッシュ全体で DEM を取るユニーク点の上限（超過頂点は +0.12 m フラット） */
const MAX_DEM_SAMPLES_TOTAL = 900;
const DEM_SAMPLE_CONCURRENCY = 12;

export type RoadMeshBuffers = {
  positions: Float32Array;
  indices: Uint32Array;
};

export type RoadPartGeo = {
  outer: [number, number][];
  holes: [number, number][][];
};

export type LuseRoadSnapshot = {
  meshKey: string;
  parts: RoadPartGeo[];
  /** キャッシュ取得時のユーザー標高（DEM） */
  pivotAltM: number;
  /** demKey(lat,lon) → 標高 m */
  demElevations: Record<string, number>;
};

const demSampler = createGsiDemPointSampler();

export function demKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function lonLatToEn(
  lon: number,
  lat: number,
  userLon: number,
  userLat: number,
  pivotLat: number
): { east: number; north: number } {
  const cosLat = Math.cos((pivotLat * Math.PI) / 180);
  const mLat = 111_320;
  return {
    east: (lon - userLon) * mLat * cosLat,
    north: (lat - userLat) * mLat
  };
}

async function fillDemCache(
  coords: Array<{ lat: number; lon: number }>,
  cache: Map<string, number>,
  signal?: AbortSignal
): Promise<void> {
  const todo = coords.filter(({ lat, lon }) => !cache.has(demKey(lat, lon)));
  let index = 0;
  async function worker(): Promise<void> {
    while (index < todo.length) {
      const i = index;
      index += 1;
      const { lat, lon } = todo[i];
      const key = demKey(lat, lon);
      try {
        const elev = await demSampler.sample(lat, lon, signal);
        cache.set(key, Number.isFinite(elev) ? elev : Number.NaN);
      } catch {
        cache.set(key, Number.NaN);
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(DEM_SAMPLE_CONCURRENCY, Math.max(1, todo.length)) },
    () => worker()
  );
  await Promise.all(workers);
}

function mergeRoadMeshBuffers(meshes: RoadMeshBuffers[]): RoadMeshBuffers[] {
  if (meshes.length <= 1) return meshes;
  let vertCount = 0;
  let indexCount = 0;
  for (const m of meshes) {
    vertCount += m.positions.length / 3;
    indexCount += m.indices.length;
  }
  const positions = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  let base = 0;
  for (const m of meshes) {
    positions.set(m.positions, vOff);
    vOff += m.positions.length;
    for (let i = 0; i < m.indices.length; i += 1) {
      indices[iOff + i] = m.indices[i] + base;
    }
    iOff += m.indices.length;
    base += m.positions.length / 3;
  }
  return [{ positions, indices }];
}

/**
 * 建物と同じく **描画フレームの userLat/userLon** を原点に EN を組み立てる。
 * @param pivotAltM 現フレームのユーザー地表標高（なければ snapshot の値）
 */
export function buildRoadMeshesAtUser(
  parts: RoadPartGeo[],
  demElevations: Record<string, number>,
  pivotAltM: number,
  userLat: number,
  userLon: number
): RoadMeshBuffers[] {
  const pivotLat = userLat;
  const mLat = 111_320;
  const cosLat = Math.cos((pivotLat * Math.PI) / 180);
  const meshes: RoadMeshBuffers[] = [];

  for (const part of parts) {
    const shape = new THREE.Shape();
    part.outer.forEach(([lon, lat], idx) => {
      const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
      if (idx === 0) shape.moveTo(east, north);
      else shape.lineTo(east, north);
    });
    for (const holeRing of part.holes) {
      const hole = new THREE.Path();
      holeRing.forEach(([lon, lat], idx) => {
        const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
        if (idx === 0) hole.moveTo(east, north);
        else hole.lineTo(east, north);
      });
      shape.holes.push(hole);
    }

    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(Math.PI / 2);
    const pos = geom.getAttribute('position');

    for (let i = 0; i < pos.count; i += 1) {
      const east = pos.getX(i);
      const north = pos.getZ(i);
      const lat = userLat + north / mLat;
      const lon = userLon + east / (mLat * cosLat);
      const elev = demElevations[demKey(lat, lon)];
      const localY =
        elev != null && Number.isFinite(elev)
          ? elev - pivotAltM + G2_ROAD_SURFACE_OFFSET_M
          : G2_ROAD_SURFACE_OFFSET_M;
      pos.setY(i, localY);
    }
    geom.computeVertexNormals();

    const index = geom.index;
    if (!index) {
      geom.dispose();
      continue;
    }
    meshes.push({
      positions: new Float32Array(pos.array),
      indices: new Uint32Array(index.array)
    });
    geom.dispose();
  }

  return mergeRoadMeshBuffers(meshes);
}

async function sampleDemForParts(
  parts: RoadPartGeo[],
  userLat: number,
  userLon: number,
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const pivotLat = userLat;
  const mLat = 111_320;
  const cosLat = Math.cos((pivotLat * Math.PI) / 180);
  const globalUnique = new Map<string, { lat: number; lon: number }>();

  for (const part of parts) {
    const shape = new THREE.Shape();
    part.outer.forEach(([lon, lat], idx) => {
      const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
      if (idx === 0) shape.moveTo(east, north);
      else shape.lineTo(east, north);
    });
    for (const holeRing of part.holes) {
      const hole = new THREE.Path();
      holeRing.forEach(([lon, lat], idx) => {
        const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
        if (idx === 0) hole.moveTo(east, north);
        else hole.lineTo(east, north);
      });
      shape.holes.push(hole);
    }
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(Math.PI / 2);
    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      const east = pos.getX(i);
      const north = pos.getZ(i);
      const lat = userLat + north / mLat;
      const lon = userLon + east / (mLat * cosLat);
      const key = demKey(lat, lon);
      if (!globalUnique.has(key)) globalUnique.set(key, { lat, lon });
    }
    geom.dispose();
  }

  const demCache = new Map<string, number>();
  const uniqueList = [...globalUnique.values()].slice(0, MAX_DEM_SAMPLES_TOTAL);
  await fillDemCache(uniqueList, demCache, signal);
  const demElevations: Record<string, number> = {};
  for (const [key, value] of demCache) {
    if (Number.isFinite(value)) demElevations[key] = value;
  }
  return demElevations;
}

export class LuseRoadCache {
  private meshKey: string | null = null;
  private parts: RoadPartGeo[] = [];
  private pivotAltM = 0;
  private demElevations: Record<string, number> = {};
  private loadGeneration = 0;

  needsFetch(latitude: number, longitude: number): boolean {
    return shouldFetchRegionalBldg(this.meshKey, latitude, longitude);
  }

  snapshot(): LuseRoadSnapshot | null {
    if (!this.meshKey || !this.parts.length) return null;
    return {
      meshKey: this.meshKey,
      parts: this.parts,
      pivotAltM: this.pivotAltM,
      demElevations: this.demElevations
    };
  }

  /** 建物描画を止めないよう、失敗時は空で続行 */
  async ensure(
    latitude: number,
    longitude: number,
    signal?: AbortSignal
  ): Promise<{ fetched: boolean; fetchMs: number }> {
    const nextKey = regionalBldgMeshKey(latitude, longitude);
    if (this.meshKey === nextKey && this.parts.length) {
      return { fetched: false, fetchMs: 0 };
    }
    const start = performance.now();
    const gen = ++this.loadGeneration;
    try {
      const parts = await fetchLuseRoadPolygonsNear(latitude, longitude, { signal });
      const pivotAlt = await demSampler.sample(latitude, longitude, signal);
      const pivotAltM = Number.isFinite(pivotAlt) ? pivotAlt : 0;
      const demElevations = await sampleDemForParts(parts, latitude, longitude, signal);
      if (gen !== this.loadGeneration) {
        return { fetched: false, fetchMs: 0 };
      }
      this.parts = parts;
      this.pivotAltM = pivotAltM;
      this.demElevations = demElevations;
      this.meshKey = nextKey;
      return { fetched: true, fetchMs: performance.now() - start };
    } catch (error) {
      if (gen === this.loadGeneration) {
        this.parts = [];
        this.demElevations = {};
        this.meshKey = nextKey;
      }
      console.warn('[luse-road]', error);
      return { fetched: false, fetchMs: performance.now() - start };
    }
  }
}
