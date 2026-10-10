/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

/**
 * Vite dev + evenhub-simulator + LAN URL の QR をまとめて起動する。
 *
 * 既定は HTTP（Even Hub プロトタイプが確実に開く）。
 * GPS 用 HTTPS は npm run dev:https（自己署名で WebView が開けない場合あり）。
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number.parseInt(process.env.PORT ?? '5173', 10);
const useHttps =
  process.argv.includes('--https')
  || process.env.HUB_DEV_HTTPS === '1';
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
  const { env: extraEnv, ...spawnOptions } = options;
  const child = spawn('npm', ['run', script], {
    cwd: hubAppRoot,
    env: {
      ...process.env,
      HUB_DEV_HTTPS: useHttps ? '1' : '0',
      ...extraEnv
    },
    shell: process.platform === 'win32',
    ...spawnOptions
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
          reject(new Error(`${host}:${port} が ${timeoutMs}ms 以内に応答しませんでした`));
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

const vite = npmRun('dev:vite', {
  stdio: 'inherit',
  env: { VITE_HUB_MODE: process.env.VITE_HUB_MODE ?? 'auto' }
});
vite.on('exit', code => shutdown(code ?? 0));

waitForPort(PORT)
  .then(() => {
    const ip = pickLanIPv4();
    const scheme = useHttps ? 'https' : 'http';
    const phoneUrl = `${scheme}://${ip}:${PORT}/`;
    const localUrl = `${scheme}://127.0.0.1:${PORT}/`;

    console.log(`\n--- Even G2 hub-app (${scheme.toUpperCase()}) ---`);
    console.log(`実機 (Even Hub で QR 読取): ${phoneUrl}`);
    console.log(`シミュレータ: ${localUrl}`);
    console.log('モード: auto（シミュレータ内は G2 送信、QR 実機はブリッジなしならプレビューのみ）');
    console.log('建物: GPS / 手動 → GeoJSON（メッシュ単位 DL）→ 288×144 → プレビュー（sim）または G2（even）');
    if (useHttps) {
      console.log(
        'HTTPS: 自己署名のため WebView が「ロード中」で止まる場合は Ctrl+C 後 npm run dev（HTTP）に戻してください'
      );
    } else {
      console.log('HTTP: プロトタイプは開きやすいが GPS は拒否されがちです。屋外 GPS は dev:https を試すかタップで再送を確認');
    }
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
