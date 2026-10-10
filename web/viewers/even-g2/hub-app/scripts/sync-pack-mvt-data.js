/**
 * .ehpk 用: 用途地域の manifest + z12 索引を public/data/mvt に同期（Vite が dist へコピー）。
 * 事前に `npm run build:mvt-index:use-district`（リポジトリルート）が必要。
 */
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(hubAppRoot, '..', '..', '..', '..');
const srcMvt = join(repoRoot, 'web', 'data', 'mvt');
const destRoot = join(hubAppRoot, 'public', 'data', 'mvt');

const datasetId = 'use-district-2025';
const manifestSrc = join(srcMvt, 'manifest', `${datasetId}.json`);
const indexSrc = join(srcMvt, 'index', datasetId);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(manifestSrc))) {
  console.error(
    `用途地域 manifest がありません: ${manifestSrc}\n`
    + 'リポジトリルートで npm run build:mvt-index:use-district を実行してください。'
  );
  process.exit(1);
}

if (!(await exists(indexSrc))) {
  console.error(
    `用途地域索引がありません: ${indexSrc}\n`
    + 'リポジトリルートで npm run build:mvt-index:use-district を実行してください。'
  );
  process.exit(1);
}

await mkdir(join(destRoot, 'manifest'), { recursive: true });
await mkdir(join(destRoot, 'index', datasetId), { recursive: true });
await cp(manifestSrc, join(destRoot, 'manifest', `${datasetId}.json`));
await cp(indexSrc, join(destRoot, 'index', datasetId), { recursive: true });

console.log(`同期: web/data/mvt (use-district) → hub-app/public/data/mvt`);
