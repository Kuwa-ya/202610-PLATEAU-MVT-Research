import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const useHttps = process.env.HUB_DEV_HTTPS === '1';
const hubAppRoot = dirname(fileURLToPath(import.meta.url));

/** Even G2 ビルド成果物（Git 外）— `web/data/README.md` */
export const EVEN_G2_BUILD_DIR = join(hubAppRoot, '..', '..', '..', 'data', 'output', 'even-g2');
export const EVEN_G2_DIST_DIR = join(EVEN_G2_BUILD_DIR, 'dist');

export default defineConfig({
  plugins: useHttps ? [basicSsl()] : [],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(useHttps ? { https: {} } : {})
  },
  build: {
    target: 'esnext',
    outDir: EVEN_G2_DIST_DIR,
    emptyOutDir: true
  }
});
