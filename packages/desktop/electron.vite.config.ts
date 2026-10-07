import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

/** Resolves workspace packages to their TypeScript source (see tsconfig.base.json). */
const SOURCE_CONDITION = '@devshare/source';

export default defineConfig({
  main: {
    // Bundle @devshare/core from source instead of loading its separate build output. With
    // core bundled, the packaged app has no runtime node_modules (see electron-builder.yml).
    build: { externalizeDeps: { exclude: ['@devshare/core'] } },
    resolve: { conditions: [SOURCE_CONDITION] },
    ssr: { resolve: { conditions: [SOURCE_CONDITION] } },
  },
  preload: {
    build: {
      rollupOptions: {
        // Sandboxed preload scripts must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
