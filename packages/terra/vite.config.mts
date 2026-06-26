/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/terra',
  resolve: {
    alias: {
      '@lunaterra/math': fileURLToPath(new URL('../../packages/math/src/index.ts', import.meta.url)),
      '@lunaterra/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@lunaterra/color': fileURLToPath(new URL('../../packages/color/src/index.ts', import.meta.url)),
      '@lunaterra/tracing': fileURLToPath(new URL('../../packages/tracing/src/index.ts', import.meta.url)),
      '@lunaterra/elements': fileURLToPath(new URL('../../packages/elements/src/index.ts', import.meta.url)),
    },
  },
  plugins: [tsconfigPaths()],
  test: {
    name: 'terra',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/terra',
      provider: 'v8' as const,
    },
  },
}));
