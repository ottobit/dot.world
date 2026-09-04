import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `src` does not exist yet; the wiki lint is the first suite.
    include: ['src/**/*.test.ts', '_system/lint/**/*.test.ts'],
  },
});
