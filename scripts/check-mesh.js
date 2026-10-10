import assert from 'node:assert/strict';
import { MeshUtils as utils } from '../web/viewers/maplibre/js/model/mesh-utils.js';
const latitude = 35.681236;
const longitude = 139.767125;

for (const digits of [4, 6, 8, 9, 10, 11]) {
  const code = utils.meshCodeFromLatLon(latitude, longitude, digits);
  const bounds = utils.meshBounds(code);
  assert.equal(code.length, digits);
  assert.ok(bounds.south <= latitude && latitude <= bounds.north);
  assert.ok(bounds.west <= longitude && longitude <= bounds.east);
}

const tile = utils.latLonToTile(latitude, longitude, 14);
const tileBounds = utils.tileBounds(tile.x, tile.y, tile.z);
assert.ok(tileBounds.south <= latitude && latitude <= tileBounds.north);
assert.ok(tileBounds.west <= longitude && longitude <= tileBounds.east);

const viewportBounds = { south: 35.67, west: 139.75, north: 35.70, east: 139.79 };
const viewportCenter = { latitude, longitude };
const meshViewport = utils.meshViewport(viewportBounds, viewportCenter, 15);
const webTileViewport = utils.webTileViewport(viewportBounds, viewportCenter, 15);

assert.equal(meshViewport.centerCode, '53394611');
assert.equal(webTileViewport.centerCode, '15/29105/12903');
assert.ok(meshViewport.codes.includes(meshViewport.centerCode));
assert.ok(webTileViewport.tiles.some(item => `${item.z}/${item.x}/${item.y}` === webTileViewport.centerCode));

console.log('地域メッシュ・Web Mercator計算: OK');
