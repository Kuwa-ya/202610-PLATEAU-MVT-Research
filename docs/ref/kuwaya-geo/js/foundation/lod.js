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

const ZOOM_15_BASE_DISTANCE = 2000;

function distanceFromZoom15(divisor) {
  return Math.floor(ZOOM_15_BASE_DISTANCE / divisor);
}

export const DISPLAY_LEVELS = [
  { detailLevel: 7, tileZoom: 7, elevationZoom: 7, fallbackElevationZoom: 7, imageZoom: 8, gridSize: 33, minDistance: distanceFromZoom15(0.01), maxDistance: Infinity },
  { detailLevel: 8, tileZoom: 8, elevationZoom: 8, fallbackElevationZoom: 8, imageZoom: 9, gridSize: 33, minDistance: distanceFromZoom15(0.02), maxDistance: distanceFromZoom15(0.01) },
  { detailLevel: 9, tileZoom: 9, elevationZoom: 9, fallbackElevationZoom: 9, imageZoom: 10, gridSize: 33, minDistance: distanceFromZoom15(0.03), maxDistance: distanceFromZoom15(0.02) },
  { detailLevel: 10, tileZoom: 10, elevationZoom: 10, fallbackElevationZoom: 10, imageZoom: 11, gridSize: 33, minDistance: distanceFromZoom15(0.06), maxDistance: distanceFromZoom15(0.03) },
  { detailLevel: 11, tileZoom: 11, elevationZoom: 11, fallbackElevationZoom: 11, imageZoom: 12, gridSize: 33, minDistance: distanceFromZoom15(0.12), maxDistance: distanceFromZoom15(0.06) },
  { detailLevel: 12, tileZoom: 12, elevationZoom: 12, fallbackElevationZoom: 12, imageZoom: 13, gridSize: 33, minDistance: distanceFromZoom15(0.25), maxDistance: distanceFromZoom15(0.12) },
  { detailLevel: 13, tileZoom: 13, elevationZoom: 13, fallbackElevationZoom: 13, imageZoom: 14, gridSize: 33, minDistance: distanceFromZoom15(0.5), maxDistance: distanceFromZoom15(0.25) },
  { detailLevel: 14, tileZoom: 14, elevationZoom: 14, fallbackElevationZoom: 14, imageZoom: 15, gridSize: 33, minDistance: distanceFromZoom15(1), maxDistance: distanceFromZoom15(0.5) },
  { detailLevel: 15, tileZoom: 15, elevationZoom: 15, fallbackElevationZoom: 15, imageZoom: 16, gridSize: 33, minDistance: distanceFromZoom15(2), maxDistance: distanceFromZoom15(1) },
  { detailLevel: 16, tileZoom: 16, elevationZoom: 16, fallbackElevationZoom: 15, imageZoom: 17, gridSize: 33, minDistance: distanceFromZoom15(4), maxDistance: distanceFromZoom15(2) },
  { detailLevel: 17, tileZoom: 17, elevationZoom: 17, fallbackElevationZoom: 15, imageZoom: 18, gridSize: 33, minDistance: distanceFromZoom15(8), maxDistance: distanceFromZoom15(4) },
  { detailLevel: 18, tileZoom: 18, elevationZoom: 17, fallbackElevationZoom: 15, imageZoom: 18, gridSize: 33, minDistance: distanceFromZoom15(16), maxDistance: distanceFromZoom15(8) },
  { detailLevel: 19, tileZoom: 19, elevationZoom: 17, fallbackElevationZoom: 15, imageZoom: 18, gridSize: 33, minDistance: distanceFromZoom15(32), maxDistance: distanceFromZoom15(16) },
  { detailLevel: 20, tileZoom: 20, elevationZoom: 17, fallbackElevationZoom: 15, imageZoom: 18, gridSize: 33, minDistance: distanceFromZoom15(64), maxDistance: distanceFromZoom15(32) }
];

export function settingForDistance(distance) {
  const normalized = Math.max(0, distance);
  return DISPLAY_LEVELS.find(setting => normalized >= setting.minDistance && normalized < setting.maxDistance)
    ?? DISPLAY_LEVELS[DISPLAY_LEVELS.length - 1];
}

export function settingWithHysteresis(distance, currentDetailLevel) {
  const candidate = settingForDistance(distance);
  const current = DISPLAY_LEVELS.find(setting => setting.detailLevel === currentDetailLevel);
  if (!current || candidate.detailLevel === current.detailLevel) return candidate;
  const lowerDetail = candidate.detailLevel > current.detailLevel ? current : candidate;
  const boundary = lowerDetail.minDistance;
  const margin = Math.max(5, boundary * 0.05);
  if (candidate.detailLevel > current.detailLevel && distance >= boundary - margin) return current;
  if (candidate.detailLevel < current.detailLevel && distance < boundary + margin) return current;
  return candidate;
}
