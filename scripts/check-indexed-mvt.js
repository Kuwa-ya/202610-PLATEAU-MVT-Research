import assert from 'node:assert/strict';
import {
  canonicalFetchTile,
  parentKeyForTile,
  parseIndexedTileUrl,
  pickFetchCityCodes
} from '../site/js/services/indexed-mvt-protocol.js';

assert.deepEqual(
  parseIndexedTileUrl('plateau-indexed://luse-2025/13101/16/58211/25806'),
  { datasetId: 'luse-2025', cityCode: '13101', z: 16, x: 58211, y: 25806 }
);
assert.equal(parentKeyForTile(58211, 25806), '12/3638/1612');
assert.deepEqual(canonicalFetchTile(18, 232847, 103225), { z: 16, x: 58211, y: 25806 });
assert.equal(canonicalFetchTile(15, 29105, 12903), null);
assert.deepEqual(pickFetchCityCodes(['13103', '13101', '13102', '13101']), ['13101', '13102', '13103']);
assert.deepEqual(pickFetchCityCodes([]), []);

console.log('2D MVT静的索引ルーティング: OK');
