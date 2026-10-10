import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  [join(root, 'tools/build-mvt-index/build.js')],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MVT_DATASET_ID: 'use-district-2025',
      SKIP_CATALOG_FETCH: process.env.SKIP_CATALOG_FETCH ?? '1'
    }
  }
);
process.exitCode = result.status ?? 1;
