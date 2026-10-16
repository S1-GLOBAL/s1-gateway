import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway';
const ACCOUNT_ADMIN_EMAILS = 'admin@sourceone.global';

const required = { DATABASE_URL, ACCOUNT_ADMIN_EMAILS };

describe('parseEnv', () => {
  it('fills in defaults when only the database and admins are given', () => {
    expect(parseEnv(required)).toEqual({
      ok: true,
      value: {
        NODE_ENV: 'development',
        PORT: 4000,
        LOG_LEVEL: 'info',
        DATABASE_URL,
        CORS_ORIGIN: 'http://localhost:5173',
        accountAdminEmails: ['admin@sourceone.global'],
      },
    });
  });

  it('reads PORT as a number', () => {
    const result = parseEnv({ ...required, PORT: '8080' });
    expect(result.ok && result.value.PORT).toBe(8080);
  });

  it('splits, trims and lower-cases ACCOUNT_ADMIN_EMAILS', () => {
    const result = parseEnv({
      ...required,
      ACCOUNT_ADMIN_EMAILS: ' Rey@SourceOne.Global , other@sourceone.global ',
    });
    expect(result.ok && result.value.accountAdminEmails).toEqual([
      'rey@sourceone.global',
      'other@sourceone.global',
    ]);
  });

  it('names the missing variable', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });

  it('names ACCOUNT_ADMIN_EMAILS when it is missing', () => {
    const result = parseEnv({ DATABASE_URL });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects an empty entry in ACCOUNT_ADMIN_EMAILS', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'admin@sourceone.global,,other@sourceone.global' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects an admin email that is not @sourceone.global', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'admin@gmail.com' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects a subdomain of sourceone.global as an admin email', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'a@mail.sourceone.global' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects a database URL that is not Postgres', () => {
    const result = parseEnv({ ...required, DATABASE_URL: 'mysql://localhost/s1' });
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });
});
