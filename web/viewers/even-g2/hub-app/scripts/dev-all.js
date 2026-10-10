/**
 * Vite dev + evenhub-simulator + LAN URL の QR をまとめて起動する。
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number.parseInt(process.env.PORT ?? '5173', 10);
const hubAppRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(hubAppRoot, '..', '..', '..', '..');
const children = [];

async function freePort(port) {
  const freePortUrl = pathToFileURL(join(repoRoot, 'scripts', 'free-port.js')).href;
  const { freePort: free } = await import(freePortUrl);
  free(port);
}

function pickLanIPv4() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      candidates.push({ name, address: entry.address });
    }
  }
  const preferred = candidates.find(({ name }) => /wi-?fi|wlan|wireless|ethernet|eth/i.test(name));
  return (preferred ?? candidates[0])?.address ?? '127.0.0.1';
}

function npmRun(script, options = {}) {
  const child = spawn('npm', ['run', script], {
    cwd: hubAppRoot,
    env: process.env,
    shell: process.platform === 'win32',
    ...options
  });
  children.push(child);
  return child;
}

function npxEvenhub(args, options = {}) {
  const child = spawn('npx', ['evenhub', ...args], {
    cwd: hubAppRoot,
    env: process.env,
    shell: process.platform === 'win32',
    ...options
  });
  children.push(child);
  return child;
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`http://${host}:${port} が ${timeoutMs}ms 以内に応答しませんでした`));
          return;
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    if (child.killed || child.exitCode !== null) continue;
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { shell: true, stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

await freePort(PORT);

const vite = npmRun('dev:vite', { stdio: 'inherit' });
vite.on('exit', code => shutdown(code ?? 0));

waitForPort(PORT)
  .then(() => {
    const ip = pickLanIPv4();
    const phoneUrl = `http://${ip}:${PORT}/`;
    const localUrl = `http://127.0.0.1:${PORT}/`;

    console.log('\n--- Even G2 hub-app ---');
    console.log(`実機 (Even Hub で QR 読取): ${phoneUrl}`);
    console.log(`シミュレータ: ${localUrl}`);
    console.log('-----------------------\n');

    npmRun('simulate', {
      detached: true,
      stdio: 'ignore'
    }).unref();

    const qr = npxEvenhub(['qr', '-u', phoneUrl], { stdio: 'inherit' });
    qr.on('exit', () => {
      console.log('\nVite とシミュレータは起動中です。終了するには Ctrl+C を押してください。\n');
    });
  })
  .catch(error => {
    console.error(error.message ?? error);
    shutdown(1);
  });
