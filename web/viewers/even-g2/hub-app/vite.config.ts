import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const useHttps = process.env.HUB_DEV_HTTPS === '1';
const hubAppRoot = dirname(fileURLToPath(import.meta.url));
const webRoot = join(hubAppRoot, '..', '..', '..');
/** 開発は simulation（QR 実機でブリッジ待ちしない）。本番 build は even */
const hubMode =
  process.env.VITE_HUB_MODE
  ?? (process.env.NODE_ENV === 'production' ? 'even' : 'simulation');

/** Even G2 ビルド成果物（Git 外）— `web/data/README.md` */
export const EVEN_G2_BUILD_DIR = join(hubAppRoot, '..', '..', '..', 'data', 'output', 'even-g2');
export const EVEN_G2_DIST_DIR = join(EVEN_G2_BUILD_DIR, 'dist');

const dataRoot = join(webRoot, 'data');

function serveWebDataPlugin(): Plugin {
  return {
    name: 'serve-web-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/data/')) return next();
        const relative = normalize(url.slice('/data/'.length));
        if (relative.startsWith('..')) {
          res.statusCode = 403;
          res.end();
          return;
        }
        const filePath = resolve(dataRoot, relative);
        if (!filePath.startsWith(resolve(dataRoot)) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const types: Record<string, string> = {
          '.json': 'application/json; charset=utf-8',
          '.mvt': 'application/vnd.mapbox-vector-tile',
          '.geojson': 'application/geo+json; charset=utf-8'
        };
        res.setHeader('Content-Type', types[extname(filePath)] ?? 'application/octet-stream');
        createReadStream(filePath).pipe(res);
      });
    }
  };
}

export default defineConfig({
  /** .ehpk 内で index.html と同階層の data/ を参照する */
  base: './',
  define: {
    'import.meta.env.VITE_HUB_MODE': JSON.stringify(hubMode)
  },
  plugins: [serveWebDataPlugin(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(useHttps ? { https: {} } : {}),
    fs: {
      allow: [hubAppRoot, webRoot]
    }
  },
  build: {
    target: 'esnext',
    outDir: EVEN_G2_DIST_DIR,
    emptyOutDir: true
  }
});
