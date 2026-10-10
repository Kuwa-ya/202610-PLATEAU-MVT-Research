import { spawnSync } from 'node:child_process';

const files = [
  'scripts/serve.js',
  'scripts/dev.js',
  'scripts/free-port.js',
  'scripts/check-mesh.js',
  'scripts/check-indexed-mvt.js',
  'tools/build-mvt-index/build.js',
  'web/shared/mvt/feature-style.js',
  'web/viewers/maplibre/js/model/mesh-utils.js',
  'web/viewers/maplibre/js/model/model.js',
  'web/viewers/maplibre/js/services/indexed-mvt-protocol.js',
  'web/viewers/maplibre/js/services/map-adapter.js',
  'web/viewers/maplibre/js/viewmodel/app-view-model.js',
  'web/viewers/maplibre/js/view/app-view.js',
  'web/viewers/maplibre/js/app.js',
  'web/viewers/three/js/app.js',
  'web/viewers/three/js/model/model.js',
  'web/viewers/three/js/viewmodel/app-view-model.js',
  'web/viewers/three/js/view/app-view.js',
  'web/viewers/three/js/services/scene-adapter.js',
  'web/viewers/three/js/services/mvt-controller.js',
  'web/viewers/three/js/services/mvt-index.js',
  'web/viewers/three/js/services/mvt-mesh.js',
  'web/viewers/even-g2/hub-app/scripts/dev-all.js',
  'scripts/generate-g2-preview-sample.js'
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`JavaScript構文: OK (${files.length}ファイル)`);
