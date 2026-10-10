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

import type { GeoJsonFeatureCollection, GeoJsonGeometry } from './geojson-types.js';

export type BuildingVolume = {
  /** 外環 [lon, lat, z?] */
  outer: Array<[number, number, number]>;
  heightM: number;
};

function ringsFromGeometry(geometry: GeoJsonGeometry | null | undefined): number[][][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][];
  return [];
}

function cleanRing(ring: number[][]): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    const z = point.length >= 3 && Number.isFinite(point[2]) ? Number(point[2]) : 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push([lon, lat, z]);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) out.pop();
  }
  return out.length >= 3 ? out : [];
}

function heightFromProperties(properties: Record<string, unknown> | undefined): number | null {
  const keys = ['measuredHeight', 'height', 'building_height', 'buildingHeight'];
  for (const key of keys) {
    const value = properties?.[key];
    if (typeof value === 'number' && value > 0) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      const n = Number(value);
      if (n > 0) return n;
    }
  }
  return null;
}

function resolveHeightM(
  ring: Array<[number, number, number]>,
  properties: Record<string, unknown> | undefined
): number {
  const zs = ring.map(p => p[2]);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  if (maxZ - minZ >= 0.5) return maxZ - minZ;
  const fromProps = heightFromProperties(properties);
  if (fromProps != null) return fromProps;
  return 10;
}

export function buildingsFromCollection(collection: GeoJsonFeatureCollection): BuildingVolume[] {
  const buildings: BuildingVolume[] = [];
  for (const feature of collection.features ?? []) {
    if (feature.type !== 'Feature') continue;
    for (const polygon of ringsFromGeometry(feature.geometry)) {
      const outer = cleanRing(polygon[0] ?? []);
      if (outer.length < 3) continue;
      buildings.push({
        outer,
        heightM: resolveHeightM(outer, feature.properties)
      });
    }
  }
  return buildings;
}
