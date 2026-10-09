/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

import { latLonToPlane, planeToLatLon } from '../geometric/jprc.js';

export function toLocalPosition(latitude, longitude, elevation, origin, zone = 9, heightScale = 1) {
  const point = latLonToPlane(latitude, longitude, zone);
  const originPlane = latLonToPlane(origin.latitude, origin.longitude, zone);
  return {
    x: point.easting - originPlane.easting,
    y: (elevation - (origin.altitude ?? 0)) * heightScale,
    z: -(point.northing - originPlane.northing)
  };
}

export function localPositionToLatLon(localX, localZ, origin, zone = 9) {
  const originPlane = latLonToPlane(origin.latitude, origin.longitude, zone);
  return planeToLatLon(
    originPlane.northing - localZ,
    originPlane.easting + localX,
    zone,
    {
      latitude: origin.latitude - localZ / 111000,
      longitude: origin.longitude + localX / (111000 * Math.max(0.01, Math.cos(origin.latitude * Math.PI / 180)))
    }
  );
}
