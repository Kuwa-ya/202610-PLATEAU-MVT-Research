/**
 * app.json の version をファイル名に含めて .ehpk を出力（上書きしない）。
 * 例: plateau-mvt-g2-v0.2.2.ehpk
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(hubAppRoot, '..', '..', '..', 'data', 'output', 'even-g2');
const distDir = join(outputDir, 'dist');

const app = JSON.parse(readFileSync(join(hubAppRoot, 'app.json'), 'utf8'));
const version = String(app.version ?? '0.0.0').replace(/[^0-9A-Za-z.-]+/g, '_');
const outFile = join(outputDir, `plateau-mvt-g2-v${version}.ehpk`);

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: hubAppRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npm', ['run', 'build']);
run('npx', ['evenhub', 'pack', 'app.json', distDir, '-o', outFile]);

console.log(`\n--- Even G2 pack ---\n${outFile}\n`);
