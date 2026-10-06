import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve workspace packages to their TypeScript source (see tsconfig.base.json).
  ssr: { resolve: { conditions: ['@devshare/source'] } },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
  },
});
