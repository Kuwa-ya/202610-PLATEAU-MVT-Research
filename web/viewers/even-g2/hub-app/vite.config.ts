import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const useHttps = process.env.HUB_DEV_HTTPS === '1';

export default defineConfig({
  plugins: useHttps ? [basicSsl()] : [],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(useHttps ? { https: true } : {})
  },
  build: { target: 'esnext' }
});
