/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUB_MODE?: 'simulation' | 'even' | 'auto';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
