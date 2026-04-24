import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './packages/core/vite.config.mts',
    test: {
      name: 'core',
      root: './packages/core',
      globals: true,
    },
  },
  {
    extends: './packages/color/vite.config.mts',
    test: {
      name: 'color',
      root: './packages/color',
      globals: true,
    },
  },
]);
