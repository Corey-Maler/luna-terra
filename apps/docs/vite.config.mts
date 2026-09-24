/// <reference types='vitest' />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const allowedHosts = (env.DOCS_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean);

  return {
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
        '@lunaterra/ui/scale-ruler': fileURLToPath(new URL('../../packages/ui/src/scale-ruler.ts', import.meta.url)),
        '@lunaterra/react': fileURLToPath(new URL('../../packages/react/src/index.ts', import.meta.url)),
        '@lunaterra/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
        '@lunaterra/terra': fileURLToPath(new URL('../../packages/terra/src/index.ts', import.meta.url)),
      },
    },
    server: {
      port: 4200,
      host: env.DOCS_BIND_HOST || 'localhost',
      allowedHosts,
    },
    preview: {
      port: 4200,
      host: env.DOCS_BIND_HOST || 'localhost',
      allowedHosts,
    },
    plugins: [react(), tsconfigPaths()],
    build: {
      outDir: '../../dist/apps/docs',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
