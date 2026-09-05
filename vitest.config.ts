import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `src` does not exist yet; the wiki lint is the first suite.
    include: ['src/**/*.test.ts', '_knowledge/lint/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
