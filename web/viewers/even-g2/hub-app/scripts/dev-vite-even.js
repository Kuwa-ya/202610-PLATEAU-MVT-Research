import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  cwd: hubAppRoot,
  stdio: 'inherit',
  env: { ...process.env, VITE_HUB_MODE: 'even' }
});
