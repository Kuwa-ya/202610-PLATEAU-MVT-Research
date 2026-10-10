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

import { createSceneAdapter } from './services/scene-adapter.js';
import { AppView } from './view/app-view.js';
import { bindViewUi, readEnabledDatasets, setStatus } from './view/view-ui.js';
import { AppViewModel } from './viewmodel/app-view-model.js';

function reportFailure(error) {
  console.error(error);
  const status = document.querySelector('#status');
  if (status) {
    status.textContent = `起動に失敗しました: ${error?.message ?? String(error)}`;
    status.classList.add('error');
  }
}

async function bootstrap() {
  const canvas = document.getElementById('mvt-canvas');
  if (!canvas) throw new Error('描画用 canvas (#mvt-canvas) が見つかりません。');

  const viewModel = new AppViewModel();
  const elements = bindViewUi(document);
  setStatus(elements, 'Three.js と地形を初期化しています…');
  const scene = await createSceneAdapter(viewModel, {
    canvas,
    ui: elements,
    readEnabledDatasets: () => readEnabledDatasets(elements)
  });
  new AppView(document, viewModel, scene, elements);
  scene.start();
}

try {
  await bootstrap();
} catch (error) {
  reportFailure(error);
}
