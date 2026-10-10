import { Model } from '../model/model.js';

export class AppViewModel extends EventTarget {
  constructor() {
    super();
    this.state = Model.createInitialState();
  }

  subscribe(listener) {
    const handler = () => listener(this.getState());
    this.addEventListener('state', handler);
    listener(this.getState());
    return () => this.removeEventListener('state', handler);
  }

  getState() {
    const state = this.state;
    return {
      ...state,
      visibility: { ...state.visibility },
      opacity: { ...state.opacity },
      status: { ...state.status },
      stats: { ...state.stats },
      viewport: {
        mesh: { ...state.viewport.mesh, codes: [...state.viewport.mesh.codes] },
        webTile: { ...state.viewport.webTile, tiles: [...state.viewport.webTile.tiles] }
      }
    };
  }

  notify() {
    this.dispatchEvent(new Event('state'));
  }

  setVisibility(kind, visible) {
    if (!(kind in this.state.visibility)) return;
    this.state.visibility[kind] = Boolean(visible);
    this.notify();
  }

  setOpacity(kind, value) {
    if (!(kind in this.state.opacity)) return;
    this.state.opacity[kind] = Math.max(0, Math.min(1, Number(value)));
    this.notify();
  }

  setStatus(message, mode = 'ready') {
    if (this.state.status.message === message && this.state.status.mode === mode) return;
    this.state.status = { message, mode };
    this.notify();
  }

  setStats(patch) {
    this.state.stats = { ...this.state.stats, ...patch };
    this.notify();
  }

  setViewport(viewport) {
    this.state.viewport = {
      mesh: {
        ...viewport.mesh,
        codes: Array.isArray(viewport.mesh?.codes) ? [...viewport.mesh.codes] : []
      },
      webTile: {
        ...viewport.webTile,
        tiles: Array.isArray(viewport.webTile?.tiles) ? [...viewport.webTile.tiles] : []
      }
    };
    this.state.stats = { ...this.state.stats, zoom: viewport.zoom };
    this.notify();
  }

  selectFeature(feature) {
    this.state.selectedFeature = feature ?? null;
    this.notify();
  }
}


