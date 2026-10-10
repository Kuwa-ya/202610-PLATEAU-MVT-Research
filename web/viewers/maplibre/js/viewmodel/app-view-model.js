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

  setDedupeFeaturesById(enabled) {
    this.state.dedupeFeaturesById = Boolean(enabled);
    this.notify();
  }

  setFeaturePickDebug(debug) {
    this.state.featurePickDebug = debug ?? null;
    this.notify();
  }
}


