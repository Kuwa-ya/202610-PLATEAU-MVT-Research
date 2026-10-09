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

const DEG_TO_RAD = Math.PI / 180;
const SEMI_MAJOR_AXIS = 6378137.0;
const INVERSE_FLATTENING = 298.257222101;
const CENTRAL_SCALE = 0.9999;

const ZONE_ORIGINS = [
  null,
  [33, 129.5], [33, 131], [36, 132 + 10 / 60], [33, 133.5],
  [36, 134 + 20 / 60], [36, 136], [36, 137 + 10 / 60], [36, 138.5],
  [36, 139 + 50 / 60], [40, 140 + 50 / 60], [44, 140.25], [44, 142.25],
  [44, 144.25], [26, 142], [26, 127.5], [26, 124], [26, 131], [20, 136], [26, 154]
];

export function getZoneOrigin(zone) {
  const origin = ZONE_ORIGINS[zone];
  if (!origin) throw new RangeError(`平面直角座標系の系番号が不正です: ${zone}`);
  return { latitude: origin[0], longitude: origin[1] };
}

function alphaCoefficients(n) {
  return [0, n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180,
    13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440,
    61 * n ** 3 / 240 - 103 * n ** 4 / 140, 49561 * n ** 4 / 161280];
}

function projectAbsolute(latitude, longitude, zone) {
  const flattening = 1 / INVERSE_FLATTENING;
  const n = flattening / (2 - flattening);
  const A = SEMI_MAJOR_AXIS / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64);
  const phi = latitude * DEG_TO_RAD;
  const lambda = longitude * DEG_TO_RAD;
  const lambda0 = getZoneOrigin(zone).longitude * DEG_TO_RAD;
  const alpha = alphaCoefficients(n);
  const c = 2 * Math.sqrt(n) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xiPrime = Math.atan2(t, Math.cos(lambda - lambda0));
  const etaPrime = Math.atanh(Math.sin(lambda - lambda0) / Math.sqrt(1 + t * t));
  let northing = xiPrime;
  let easting = etaPrime;
  for (let j = 1; j <= 4; j += 1) {
    northing += alpha[j] * Math.sin(2 * j * xiPrime) * Math.cosh(2 * j * etaPrime);
    easting += alpha[j] * Math.cos(2 * j * xiPrime) * Math.sinh(2 * j * etaPrime);
  }
  return { northing: northing * A * CENTRAL_SCALE, easting: easting * A * CENTRAL_SCALE };
}

export function latLonToPlane(latitude, longitude, zone = 9) {
  const origin = getZoneOrigin(zone);
  const originPlane = projectAbsolute(origin.latitude, origin.longitude, zone);
  const point = projectAbsolute(latitude, longitude, zone);
  return { northing: point.northing - originPlane.northing, easting: point.easting - originPlane.easting };
}

export function planeToLatLon(northing, easting, zone = 9, initial = getZoneOrigin(zone)) {
  let latitude = initial.latitude;
  let longitude = initial.longitude;
  const delta = 1e-6;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const point = latLonToPlane(latitude, longitude, zone);
    const errorNorthing = northing - point.northing;
    const errorEasting = easting - point.easting;
    if (Math.hypot(errorNorthing, errorEasting) < 1e-5) break;
    const latitudeStep = latLonToPlane(latitude + delta, longitude, zone);
    const longitudeStep = latLonToPlane(latitude, longitude + delta, zone);
    const northByLatitude = (latitudeStep.northing - point.northing) / delta;
    const eastByLatitude = (latitudeStep.easting - point.easting) / delta;
    const northByLongitude = (longitudeStep.northing - point.northing) / delta;
    const eastByLongitude = (longitudeStep.easting - point.easting) / delta;
    const determinant = northByLatitude * eastByLongitude - northByLongitude * eastByLatitude;
    if (Math.abs(determinant) < 1e-12) break;
    latitude += (errorNorthing * eastByLongitude - errorEasting * northByLongitude) / determinant;
    longitude += (northByLatitude * errorEasting - eastByLatitude * errorNorthing) / determinant;
  }
  return { latitude, longitude };
}
