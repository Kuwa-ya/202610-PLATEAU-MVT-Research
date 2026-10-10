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

/** Web Mercator タイル（Mapbox / PLATEAU MVT 想定） */

export const MVT_FETCH_ZOOM = 16;

export function latLonToTile(latitude, longitude, zoom = MVT_FETCH_ZOOM) {
  const lat = Math.max(-85.0511287798066, Math.min(85.0511287798066, latitude));
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale);
  return { z: zoom, x, y };
}

/** タイル内座標（レイヤ extent 単位） */
export function lonLatToTilePoint(longitude, latitude, z, tileX, tileY, extent = 4096) {
  const scale = 2 ** z;
  const worldX = ((longitude + 180) / 360) * scale * extent;
  const latRad = (latitude * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale * extent;
  return {
    x: worldX - tileX * extent,
    y: worldY - tileY * extent
  };
}

export function tilePointToLonLat(z, tileX, tileY, extent, px, py) {
  const scale = 2 ** z;
  const worldX = tileX * extent + px;
  const worldY = tileY * extent + py;
  const lon = (worldX / (scale * extent)) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * worldY) / (scale * extent);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lon, lat];
}
