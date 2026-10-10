/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

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

  setAddressSearchStatus(message) {
    const text = message ?? '';
    if (this.state.addressSearchStatus === text) return;
    this.state.addressSearchStatus = text;
    this.notify();
  }

  setSelectedFeature(feature) {
    const prev = this.state.selectedFeature;
    const next = feature
      ? { kind: feature.kind, properties: { ...feature.properties } }
      : null;
    if (prev?.kind === next?.kind && prev?.properties?.gml_id === next?.properties?.gml_id) return;
    this.state.selectedFeature = next;
    this.notify();
  }
}
