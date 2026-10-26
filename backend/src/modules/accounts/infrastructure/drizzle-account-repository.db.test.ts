import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { Account } from '../domain/account.js';
import { AccountExistsError } from '../domain/account.errors.js';
import { accounts } from './accounts.table.js';
import { DrizzleAccountRepository } from './drizzle-account-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleAccountRepository(connection.db);
const CREATED_AT = new Date('2026-10-16T08:00:00.000Z');

function account(id: string, email: string, autoApprove = false) {
  const result = Account.register(
    { email, firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove },
    id,
    CREATED_AT,
  );
  if (!result.ok) throw new Error('setup failed');
  return result.value;
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzleAccountRepository', () => {
  it('round-trips every field', async () => {
    await repository.add(account('11111111-1111-4111-8111-111111111111', 'staff@sourceone.global', true));
    const stored = await repository.findByEmail('staff@sourceone.global');
    expect(stored?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(stored?.email).toBe('staff@sourceone.global');
    expect(stored?.fullName).toBe('Staff Member');
    expect(stored?.status).toBe('approved');
    expect(stored?.role).toBe('staff');
    expect(stored?.mustChangePassword).toBe(false);
    expect(stored?.failedSignInCount).toBe(0);
    expect(stored?.lockedUntil).toBeNull();
    expect(stored?.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(stored?.approvedBy).toBe('11111111-1111-4111-8111-111111111111');
    expect(stored?.approvedAt?.toISOString()).toBe(CREATED_AT.toISOString());
    expect(stored?.firstName).toBe('Staff');
    expect(stored?.lastName).toBe('Member');
  });

  it('saves a changed role', async () => {
    const staff = account('11111111-1111-4111-8111-111111111111', 'staff@sourceone.global', true);
    await repository.add(staff);
    await repository.save(staff.withRole('system-admin'));
    expect((await repository.findById(staff.id))?.role).toBe('system-admin');
  });

  it('refuses a role the check constraint does not know', async () => {
    await repository.add(account('11111111-1111-4111-8111-111111111111', 'staff@sourceone.global', true));
    await expect(connection.db.update(accounts).set({ role: 'owner' })).rejects.toThrow();
  });

  it('writes full_name as "First Last"', async () => {
    await repository.add(account('11111111-1111-4111-8111-111111111111', 'staff@sourceone.global'));
    const [row] = await connection.db.select({ fullName: accounts.fullName }).from(accounts);
    expect(row?.fullName).toBe('Staff Member');
  });

  it('stores 40-character first and last names, an 81-character full name', async () => {
    const first = 'A'.repeat(40);
    const last = 'B'.repeat(40);
    const registered = Account.register(
      { email: 'long@sourceone.global', firstName: first, lastName: last, passwordHash: 'hash', autoApprove: true },
      '99999999-9999-4999-8999-999999999999',
      CREATED_AT,
    );
    expect((await repository.add(registered.value)).ok).toBe(true);

    const stored = await repository.findByEmail('long@sourceone.global');
    expect(stored?.firstName).toBe(first);
    expect(stored?.lastName).toBe(last);
    expect(stored?.fullName).toBe(`${first} ${last}`);
    expect(stored?.fullName).toHaveLength(81);
  });

  it('reads a row with both names empty with them split from full_name, as migration 0008 does', async () => {
    // What the previous release writes during a deploy: no first or last name.
    await connection.db.insert(accounts).values({
      id: '12121212-1212-4121-8121-121212121212',
      email: 'old@sourceone.global',
      fullName: 'Ada King Lovelace',
      passwordHash: 'hash',
      status: 'approved',
      createdAt: CREATED_AT,
    });

    const stored = await repository.findByEmail('old@sourceone.global');
    expect(stored?.firstName).toBe('Ada');
    expect(stored?.lastName).toBe('King Lovelace');
    expect(stored?.fullName).toBe('Ada King Lovelace');
  });

  it('finds by id', async () => {
    const created = account('22222222-2222-4222-8222-222222222222', 'byid@sourceone.global');
    await repository.add(created);
    const stored = await repository.findById(created.id);
    expect(stored?.email).toBe('byid@sourceone.global');
  });

  it('returns null when no account matches', async () => {
    expect(await repository.findByEmail('nobody@sourceone.global')).toBeNull();
    expect(await repository.findById('33333333-3333-4333-8333-333333333333')).toBeNull();
  });

  it('refuses a second account with the same email', async () => {
    await repository.add(account('44444444-4444-4444-8444-444444444444', 'dupe@sourceone.global'));
    const result = await repository.add(account('55555555-5555-4555-8555-555555555555', 'dupe@sourceone.global'));
    expect(!result.ok && result.error).toBeInstanceOf(AccountExistsError);
  });

  it('saves changes to lockout and password fields', async () => {
    const created = account('66666666-6666-4666-8666-666666666666', 'lockout@sourceone.global');
    await repository.add(created);
    const failedAt = new Date('2026-10-16T08:00:00.000Z');
    let updated = created;
    for (let i = 0; i < 5; i += 1) updated = updated.recordFailedSignIn(failedAt);
    await repository.save(updated);

    const stored = await repository.findById(created.id);
    expect(stored?.failedSignInCount).toBe(5);
    expect(stored?.lockedUntil?.toISOString()).toBe(new Date(failedAt.getTime() + 15 * 60_000).toISOString());
  });

  it('lists every account', async () => {
    await repository.add(account('77777777-7777-4777-8777-777777777777', 'one@sourceone.global'));
    await repository.add(account('88888888-8888-4888-8888-888888888888', 'two@sourceone.global'));
    const all = await repository.list();
    expect(all.map((stored) => stored.email).sort()).toEqual(['one@sourceone.global', 'two@sourceone.global']);
  });
});
