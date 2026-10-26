import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleAccountRepository } from '../modules/accounts/infrastructure/drizzle-account-repository.js';
import { ScryptPasswordHasher } from '../modules/accounts/infrastructure/scrypt-password-hasher.js';
import { connectTestDatabase, resetTables } from '../test/database.js';
import { createAdmin, type CreateAdminInput } from './create-admin.js';

const connection = connectTestDatabase();
beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

const INPUT: CreateAdminInput = {
  email: ' Admin@SourceOne.Global ',
  firstName: 'Admin',
  lastName: 'User',
  password: 'a-long-enough-password',
  nodeEnv: 'test',
  accountAdminEmails: ['admin@sourceone.global'],
};

describe('createAdmin', () => {
  it('creates an approved System Admin with both names, the password stored only as its hash', async () => {
    const result = await createAdmin(connection.db, INPUT);

    expect(result.ok && result.value).toEqual({
      id: expect.any(String),
      email: 'admin@sourceone.global',
      fullName: 'Admin User',
    });
    const stored = await new DrizzleAccountRepository(connection.db).findByEmail('admin@sourceone.global');
    expect(stored).toMatchObject({
      status: 'approved',
      role: 'system-admin',
      firstName: 'Admin',
      lastName: 'User',
      mustChangePassword: false,
    });
    expect(stored?.passwordHash).not.toContain(INPUT.password);
    expect(await new ScryptPasswordHasher().verify(INPUT.password, stored!.passwordHash)).toBe(true);
  });

  it('refuses an email that already has an account, and changes nothing', async () => {
    const first = await createAdmin(connection.db, INPUT);
    const again = await createAdmin(connection.db, { ...INPUT, firstName: 'Other', password: 'another-long-password' });

    expect(again).toEqual({ ok: false, error: '--email: an account already exists for admin@sourceone.global.' });
    const accounts = await new DrizzleAccountRepository(connection.db).list();
    expect(accounts.map((account) => [account.id, account.fullName])).toEqual([[first.ok && first.value.id, 'Admin User']]);
  });
});
