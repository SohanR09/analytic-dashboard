import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Redis-backed tests share one Redis DB, so run files sequentially.
    fileParallelism: false,
  },
});
