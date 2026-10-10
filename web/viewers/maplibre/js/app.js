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
    onFeatureSelected: feature => viewModel.selectFeature(feature),
    onStatus: (message, mode) => viewModel.setStatus(message, mode),
    onStats: stats => viewModel.setStats(stats)
  });
}

try {
  bootstrap();
} catch (error) {
  reportFailure(error);
}

