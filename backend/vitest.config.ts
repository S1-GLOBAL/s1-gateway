import { defineConfig } from 'vitest/config';

/**
 * Every test, including the ones that need Postgres (`*.db.test.ts`).
 *
 * The database URL is decided here, before any module loads, so nothing in
 * the application reads a test-specific variable. `TEST_DATABASE_URL` wins;
 * otherwise the Docker database's `_test` sibling is used.
 */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway_test';

// globalSetup runs before the test environment exists, so it reads this from
// the inherited process environment rather than from `test.env`.
process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // One database, shared: parallel files would truncate each other's rows.
    fileParallelism: false,
    globalSetup: ['./src/test/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL, LOG_LEVEL: 'silent' },
    hookTimeout: 60_000,
  },
});
