import assert from 'node:assert/strict';
import { MVT_COLORS, featureColor, isLandUseRoad, landUseColor } from '../web/shared/mvt/feature-style.js';

assert.equal(isLandUseRoad({ uro_orgLandUse: '道路' }), true);
assert.equal(isLandUseRoad({ luse_class: '第1種道路用地' }), true);
assert.equal(isLandUseRoad({ luse_class: '商業用地' }), false);
assert.equal(landUseColor({ uro_orgLandUse: '道路' }), MVT_COLORS.luseRoad);
assert.equal(landUseColor({ luse_class: '道路用地' }), MVT_COLORS.luseRoad);
assert.equal(landUseColor({ uro_orgLandUse: '都市公園' }), MVT_COLORS.lusePark);
assert.equal(landUseColor({ uro_orgLandUse: '水面・河川・水路' }), MVT_COLORS.luseWater);
assert.equal(landUseColor({ uro_orgLandUse: '事務所建築物' }), MVT_COLORS.luseDefault);
assert.equal(featureColor('tran-lod1-2025', {}, MVT_COLORS.transport), MVT_COLORS.transport);

console.log('MVT土地利用スタイル判定: OK');
