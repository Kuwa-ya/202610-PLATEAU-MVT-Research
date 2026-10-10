/** kuwaya-geo BUILDING_MIN_LOD / TRANSPORT_MIN_LOD（16）に合わせる */
import { DATA_BASE } from '../../../shared/mvt/data-region.js';
import { MVT_COLORS } from '../../../shared/mvt/feature-style.js';

export { DATA_BASE };

export const MVT_MIN_DETAIL_LEVEL = 16;
export const MVT_FETCH_ZOOM = 16;
export const MVT_INDEX_ZOOM = 12;

export const DATASETS = Object.freeze([
  { id: 'luse-2025', label: '土地利用', color: MVT_COLORS.luseDefault, opacity: 0.55 },
  { id: 'tran-lod1-2025', label: '道路 LOD1', color: MVT_COLORS.transport, opacity: 0.65 }
]);

/** この距離より近いと MVT を読込（初期カメラは約 500m） */
export const MVT_MAX_CAMERA_DISTANCE = 900;
