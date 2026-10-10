import { createSceneAdapter } from './services/scene-adapter.js';
import { AppView } from './view/app-view.js';
import { bindViewUi, readEnabledDatasets } from './view/view-ui.js';
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
