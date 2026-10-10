/*!
 * PLATEAU MVT Research — TypeScript source module
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
