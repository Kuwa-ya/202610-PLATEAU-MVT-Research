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
      status: { ...state.status },
      loading: { ...state.loading },
      metadata: { ...state.metadata },
      origin: { ...state.origin }
    };
  }

  notify() {
    this.dispatchEvent(new Event('state'));
  }

  setStatus(message, isError = false) {
    if (this.state.status.message === message && this.state.status.isError === isError) return;
    this.state.status = { message, isError };
    this.notify();
  }

  setLoading(visible, message = '') {
    const next = { visible: Boolean(visible), message: message || '' };
    if (this.state.loading.visible === next.visible && this.state.loading.message === next.message) return;
    this.state.loading = next;
    this.notify();
  }

  setMetadata(patch) {
    this.state.metadata = { ...this.state.metadata, ...patch };
    if (patch.statusLine) {
      this.state.status = {
        message: patch.statusLine,
        isError: Boolean(patch.isError)
      };
    }
    this.notify();
  }

  setOrigin(lat, lon) {
    this.state.origin = { lat, lon };
    this.notify();
  }
}
