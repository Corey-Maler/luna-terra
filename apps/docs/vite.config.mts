/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/docs',
  resolve: {
    alias: {
      '@lunaterra/math': fileURLToPath(new URL('../../packages/math/src/index.ts', import.meta.url)),
      '@lunaterra/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@lunaterra/color': fileURLToPath(new URL('../../packages/color/src/index.ts', import.meta.url)),
      '@lunaterra/tracing': fileURLToPath(new URL('../../packages/tracing/src/index.ts', import.meta.url)),
      '@lunaterra/elements': fileURLToPath(new URL('../../packages/elements/src/index.ts', import.meta.url)),
      '@lunaterra/charts': fileURLToPath(new URL('../../packages/charts/src/index.ts', import.meta.url)),
      '@lunaterra/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [react(), tsconfigPaths()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ tsconfigPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/docs',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
