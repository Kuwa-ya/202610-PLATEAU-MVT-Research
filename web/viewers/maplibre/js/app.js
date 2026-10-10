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

import { MapAdapter } from './services/map-adapter.js';
import { AppView } from './view/app-view.js';
import { AppViewModel } from './viewmodel/app-view-model.js';

function reportFailure(error) {
  console.error(error);
  const status = document.getElementById('status');
  const text = document.getElementById('status-text');
  status?.classList.add('error');
  if (text) text.textContent = `起動に失敗しました: ${error?.message ?? String(error)}`;
}

function bootstrap() {
  if (!globalThis.maplibregl) throw new Error('MapLibre GL JSを読み込めませんでした。');
  const viewModel = new AppViewModel();
  const mapAdapter = new MapAdapter(globalThis.maplibregl, 'map');
  new AppView(document, viewModel, mapAdapter);

  mapAdapter.initialize({
    onViewportChanged: viewport => viewModel.setViewport(viewport),
    onFeatureSelected: feature => {
      viewModel.selectFeature(feature);
    },
    onStatus: (message, mode) => viewModel.setStatus(message, mode),
    onStats: stats => viewModel.setStats(stats)
  });
}

try {
  bootstrap();
} catch (error) {
  reportFailure(error);
}

