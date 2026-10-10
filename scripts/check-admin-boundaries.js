import assert from 'node:assert/strict';
import {
  adminGeometriesForCityCode,
  geometryIntersectsBounds,
  loadAdminBoundaries
} from '../tools/build-mvt-index/admin-boundaries.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const polygon = {
  type: 'Polygon',
  coordinates: [[
    [139, 35], [140, 35], [140, 36], [139, 36], [139, 35]
  ], [
    [139.4, 35.4], [139.6, 35.4], [139.6, 35.6], [139.4, 35.6], [139.4, 35.4]
  ]]
};

assert.equal(geometryIntersectsBounds(polygon, {
  west: 139.1, east: 139.2, south: 35.1, north: 35.2
}), true, '自治体内部');
assert.equal(geometryIntersectsBounds(polygon, {
  west: 139.95, east: 140.05, south: 35.5, north: 35.6
}), true, '自治体境界との交差');
assert.equal(geometryIntersectsBounds(polygon, {
  west: 139.45, east: 139.55, south: 35.45, north: 35.55
}), false, 'ポリゴンの穴');
assert.equal(geometryIntersectsBounds(polygon, {
  west: 140.1, east: 140.2, south: 35.1, north: 35.2
}), false, '自治体外部');

const kyotoPath = join(repoRoot, 'web/data/boundaries/kyoto-cities.geojson');
const kyotoBoundaries = await loadAdminBoundaries(kyotoPath);
assert.equal(kyotoBoundaries.size, 36, '京都府 36 市町村');
const kyotoWardGeoms = adminGeometriesForCityCode('26100', kyotoBoundaries);
assert.equal(kyotoWardGeoms.length, 11, '京都市 26100 は 11 区ポリゴンで判定');

console.log('行政界ポリゴン・タイル交差判定: OK');
