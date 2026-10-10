/**
 * .ehpk 用: MVT 用途地域索引 + 住所 pack を public/data に同期。
 * 住所正本・再生成: docs/ref/address-data.md
 */
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(hubAppRoot, '..', '..', '..', '..');
const webData = join(repoRoot, 'web', 'data');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function syncUseDistrict() {
  const datasetId = 'use-district-2025';
  const srcMvt = join(webData, 'mvt');
  const destRoot = join(hubAppRoot, 'public', 'data', 'mvt');
  const manifestSrc = join(srcMvt, 'manifest', `${datasetId}.json`);
  const indexSrc = join(srcMvt, 'index', datasetId);

  if (!(await exists(manifestSrc)) || !(await exists(indexSrc))) {
    console.error(
      `用途地域 manifest/索引がありません。\n`
        + 'リポジトリルートで npm run build:mvt-index:use-district を実行してください。'
    );
    process.exit(1);
  }

  await mkdir(join(destRoot, 'manifest'), { recursive: true });
  await mkdir(join(destRoot, 'index', datasetId), { recursive: true });
  await cp(manifestSrc, join(destRoot, 'manifest', `${datasetId}.json`));
  await cp(indexSrc, join(destRoot, 'index', datasetId), { recursive: true });
  console.log('同期: web/data/mvt (use-district) → public/data/mvt');
}

async function syncAddress() {
  const src = join(webData, 'address');
  const manifestSrc = join(src, 'manifest.json');
  const citiesSrc = join(src, 'cities.geojson');
  const chomeSrc = join(src, 'chome');

  if (!(await exists(manifestSrc)) || !(await exists(citiesSrc)) || !(await exists(chomeSrc))) {
    console.error(
      `住所 pack がありません: ${src}\n`
        + 'ビルド前に node scripts/build-address-pack.js（リポジトリルート）を実行してください。'
    );
    process.exit(1);
  }

  const dest = join(hubAppRoot, 'public', 'data', 'address');
  await mkdir(dest, { recursive: true });
  await cp(manifestSrc, join(dest, 'manifest.json'));
  await cp(citiesSrc, join(dest, 'cities.geojson'));
  await cp(chomeSrc, join(dest, 'chome'), { recursive: true });
  console.log('同期: web/data/address → public/data/address');
}

await syncUseDistrict();
await syncAddress();
