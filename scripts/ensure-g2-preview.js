/**
 * G2 プレビュー PNG の正本は web/data/output/previews/。
 * hub-app の public/ へ同期（ビルド・パック用）。無ければ generate を実行。
 */
import { access, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = join(root, 'web', 'data', 'output', 'previews', 'preview.png');
const hubPublic = join(root, 'web', 'viewers', 'even-g2', 'hub-app', 'public', 'preview.png');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(canonical))) {
  console.log('プレビュー PNG がありません。generate:g2-preview を実行します…');
  const result = spawnSync(process.execPath, ['scripts/generate-g2-preview-sample.js'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await mkdir(dirname(hubPublic), { recursive: true });
await copyFile(canonical, hubPublic);
console.log(`同期: ${canonical} → ${hubPublic}`);
