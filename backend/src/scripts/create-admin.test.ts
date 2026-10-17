import { describe, expect, it } from 'vitest';
import type { Database } from '../shared/infrastructure/database/connection.js';
import { createAdmin, type CreateAdminInput } from './create-admin.js';

/** A refusal must come before any write: this database throws if it is touched at all. */
const untouchable = new Proxy(
  {},
  {
    get() {
      throw new Error('createAdmin touched the database before refusing');
    },
  },
) as Database;

const INPUT: CreateAdminInput = {
  email: 'admin@sourceone.global',
  firstName: 'Admin',
  lastName: 'User',
  password: 'a-long-enough-password',
  nodeEnv: 'development',
  accountAdminEmails: ['admin@sourceone.global'],
};

describe('createAdmin refuses', () => {
  it('to run with NODE_ENV=production', async () => {
    const result = await createAdmin(untouchable, { ...INPUT, nodeEnv: 'production' });
    expect(result).toEqual({
      ok: false,
      error: 'Refusing to run with NODE_ENV=production: create-admin is for local development and tests.',
    });
  });

  it('an email that is not in ACCOUNT_ADMIN_EMAILS', async () => {
    const result = await createAdmin(untouchable, { ...INPUT, email: 'staff@sourceone.global' });
    expect(result).toEqual({
      ok: false,
      error: '--email: staff@sourceone.global is not in ACCOUNT_ADMIN_EMAILS, so it would not be an admin.',
    });
  });

  it('an email that is not @sourceone.global', async () => {
    const result = await createAdmin(untouchable, { ...INPUT, email: 'admin@example.com' });
    expect(result).toEqual({ ok: false, error: '--email: Use your @sourceone.global email address.' });
  });

  it('a missing last name, with the same words as registering', async () => {
    const result = await createAdmin(untouchable, { ...INPUT, lastName: '  ' });
    expect(result).toEqual({ ok: false, error: '--last-name: Enter your last name.' });
  });

  it('a password under 12 characters', async () => {
    const result = await createAdmin(untouchable, { ...INPUT, password: 'short' });
    expect(result).toEqual({ ok: false, error: 'ADMIN_PASSWORD: Use at least 12 characters.' });
  });
});
