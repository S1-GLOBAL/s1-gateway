import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

/**
 * Runs once before any test file: creates the test database if it is missing,
 * then migrates it. Fails with an instruction, not two hundred red tests, when
 * Postgres is not running.
 */
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL was not set by vitest.config.ts.');

  const name = new URL(url).pathname.slice(1);

  // Tests truncate tables. Refusing anything not named *_test makes wiping
  // the development database impossible rather than merely unlikely.
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${name}". Use a database whose name ends in "_test".`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  let admin: postgres.Sql;
  try {
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => undefined });
    await admin`select 1`;
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${adminUrl.host}. Run "npm run db:up" and try again.\n`
        + `Original error: ${(error as Error).message}`,
    );
  }

  try {
    const existing = await admin`select 1 from pg_database where datname = ${name}`;
    // An identifier cannot be a parameter; `name` was checked above.
    if (existing.length === 0) await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  execFileSync('npm', ['run', 'db:migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: true,
  });
}
