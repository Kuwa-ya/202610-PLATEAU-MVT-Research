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

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 111_320;

/** ユーザー位置基準の東北座標（m）— WebGL 建物メッシュと同じ */
export function lonLatToEnMeters(
  lon: number,
  lat: number,
  userLon: number,
  userLat: number,
  pivotLat: number
): { east: number; north: number } {
  const cosLat = Math.cos(pivotLat * DEG_TO_RAD);
  return {
    east: (lon - userLon) * METERS_PER_DEG_LAT * cosLat,
    north: (lat - userLat) * METERS_PER_DEG_LAT
  };
}

/** 建物 footprint と同じ: shape (east,north) → rotateX(π/2) 後の地上点 */
export function enToGroundVector3(east: number, north: number, heightM = 0.45): {
  x: number;
  y: number;
  z: number;
} {
  return { x: east, y: heightM, z: north };
}
