import { defineConfig } from 'vitest/config';

/** Everything that runs without a database: domain, application, presentation. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', 'node_modules/**'],
  },
});
