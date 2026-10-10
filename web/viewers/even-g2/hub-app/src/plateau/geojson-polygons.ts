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

type LonLat = [number, number];

function ringsFromGeometry(geometry: GeoJsonGeometry | null | undefined): LonLat[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as LonLat[][]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as LonLat[][][];
  }
  return [];
}

/** 外環のみ（PoC）。各要素は [lon, lat] の閉じたリング */
export function footprintRings(collection: GeoJsonFeatureCollection): LonLat[][] {
  const rings: LonLat[][] = [];
  for (const feature of collection.features ?? []) {
    const fromGeom = ringsFromGeometry(feature.geometry);
    for (const polygon of fromGeom) {
      const outer = polygon[0];
      if (outer && outer.length >= 3) rings.push(outer);
    }
  }
  return rings;
}
