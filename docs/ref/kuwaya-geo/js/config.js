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

export const DISPLAY_RADIUS = 1;
export const TERRAIN_CACHE_LIMIT = 256;
export const TILE_NOT_FOUND_CACHE_LIMIT = 1024;
export const TILE_NOT_FOUND_TTL_MS = 5 * 60 * 1000;
export const TERRAIN_STREAM_DELAY = 180;
export const TERRAIN_STREAM_ACTIVE_DELAY = 350;
export const TERRAIN_LOD_DELAY = 220;
export const LOAD_CONCURRENCY = 4;
export const LOAD_PRIORITY = Object.freeze({
  terrainCenter: 10,
  terrainRing: 20,
  elevation: 25,
  buildingCenter: 30,
  buildingRing: 40,
  transportCenter: 50,
  transportRing: 60,
  default: 80
});
export const CONTOUR_UPDATE_IDLE_TIMEOUT = 2000;
export const ACCESS_COUNTER_URL = 'https://api.kuwa-ya.co.jp/accessCounter';
export const ACCESS_COUNTER_KEY = 'geo';
export const ADDRESS_GEOCODE_URL = 'https://sakura.kuwa-ya.co.jp/address/geocode';
export const ADDRESS_GEOCODE_LOCAL_URL = '/devegokko-api/address/geocode';
export const ADDRESS_API_KEY = '9444f3d5298a85bacd3ca0a22db8ccb4f1297c9faeffc900';
// 'gzip' → ./geojson-gzip/**/*.geojson.gz
// 'json' → ./geojson/**/*.geojson
export const FEATURE_GEOJSON_FORMAT = 'gzip';
export const FEATURE_GEOJSON_PATHS = Object.freeze({
  gzip: { root: './geojson-gzip', extension: '.geojson.gz' },
  json: { root: './geojson', extension: '.geojson' }
});
export const BUILDING_MIN_LOD = 16;
export const BUILDING_DISPLAY_RADIUS = 5;
export const TRANSPORT_MIN_LOD = 16;
export const MAX_EXPORT_TILES = 100;
export const MAX_REGIONAL_MESH_EXPORTS = 100;
export const INITIAL_LOCATION = Object.freeze({ latitude: 35.681, longitude: 139.767 });
export const CAMERA_DEFAULT_DISTANCE = 800;
export const CAMERA_MIN_DISTANCE = 20;
export const CAMERA_MAX_DISTANCE = 50_000;
export const CAMERA_MIN_ANGLE = Math.PI / 36;
export const CAMERA_MAX_ANGLE = Math.PI / 2;
export const CAMERA_MAX_MOVE_FROM_ORIGIN = 1_000_000;
export const CAMERA_LERP_RATE = -Math.log(0.9) / 0.01;
export const CAMERA_DRAG_THRESHOLD_SQUARED = 20 ** 2;
export const CONTOUR_OFFSET_BASE_LOD = 17;
export const CONTOUR_OFFSET_MIN = 1.0;
export const CONTOUR_OFFSET_MAX = 64.0;
export const CONTOUR_MAJOR_EVERY = 5;
export const CONTOUR_MINOR_COLOR = 0x6666ff;
export const CONTOUR_MAJOR_COLOR = 0x0000ff;
export const CONTOUR_LEVELS = Object.freeze([
  { minLod: 19, interval: 1, labelHeight: 4, displayLabelPixels: 32 },
  { minLod: 17, interval: 2, labelHeight: 5, displayLabelPixels: 29 },
  { minLod: 15, interval: 5, labelHeight: 8, displayLabelPixels: 26 },
  { minLod: 13, interval: 10, labelHeight: 16, displayLabelPixels: 23 },
  { minLod: 11, interval: 20, labelHeight: 32, displayLabelPixels: 21 },
  { minLod: 9, interval: 50, labelHeight: 64, displayLabelPixels: 19 },
  { minLod: 7, interval: 100, labelHeight: 128, displayLabelPixels: 17 }
]);
/** 自動LOD対応外の手動ピッチ候補（ドロップダウンへ追加） */
export const CONTOUR_EXTRA_INTERVALS = Object.freeze([0.1, 0.2, 0.5]);
