import { MVT_MAX_CAMERA_DISTANCE } from '../services/mvt-config.js';

const CONFIG = Object.freeze({
  mvtMaxCameraDistance: MVT_MAX_CAMERA_DISTANCE
});

function createInitialState() {
  return {
    status: { message: 'Three.js を読み込み中…', isError: false },
    loading: { visible: false, message: '' },
    metadata: {
      viewLat: null,
      viewLon: null,
      distance: 0,
      tileCount: 0,
      planned: 0,
      mvtMode: '待機',
      mvtTilesLabel: '—',
      hintLine: '',
      isError: false
    },
    origin: { lat: null, lon: null }
  };
}

export const Model = {
  CONFIG,
  createInitialState
};
