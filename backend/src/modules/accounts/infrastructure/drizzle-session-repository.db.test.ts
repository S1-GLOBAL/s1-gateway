import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { Account } from '../domain/account.js';
import { Session } from '../domain/session.js';
import { DrizzleAccountRepository } from './drizzle-account-repository.js';
import { DrizzleSessionRepository } from './drizzle-session-repository.js';

const connection = connectTestDatabase();
const accountRepository = new DrizzleAccountRepository(connection.db);
const repository = new DrizzleSessionRepository(connection.db);
const CREATED_AT = new Date('2026-10-16T08:00:00.000Z');

async function seedAccount(id: string): Promise<void> {
  const result = Account.register(
    { email: `${id}@sourceone.global`, firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove: true },
    id,
    CREATED_AT,
  );
  if (!result.ok) throw new Error('setup failed');
  await accountRepository.add(result.value);
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzleSessionRepository', () => {
  it('round-trips every field', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    await seedAccount(accountId);
    const session = Session.create(accountId, 'hash-abc', '22222222-2222-4222-8222-222222222222', CREATED_AT);
    await repository.add(session);

    const stored = await repository.findByTokenHash('hash-abc');
    expect(stored?.id).toBe(session.id);
    expect(stored?.accountId).toBe(accountId);
    expect(stored?.expiresAt.toISOString()).toBe(session.expiresAt.toISOString());
    expect(stored?.lastSeenAt.toISOString()).toBe(CREATED_AT.toISOString());
  });

  it('returns null for an unknown token', async () => {
    expect(await repository.findByTokenHash('missing')).toBeNull();
  });

  it('saves a renewal', async () => {
    const accountId = '33333333-3333-4333-8333-333333333333';
    await seedAccount(accountId);
    const session = Session.create(accountId, 'hash-renew', '44444444-4444-4444-8444-444444444444', CREATED_AT);
    await repository.add(session);

    const renewedAt = new Date('2026-10-20T00:00:00.000Z');
    await repository.save(session.renew(renewedAt));

    const stored = await repository.findByTokenHash('hash-renew');
    expect(stored?.lastSeenAt.toISOString()).toBe(renewedAt.toISOString());
  });

  it('deletes by token hash', async () => {
    const accountId = '55555555-5555-4555-8555-555555555555';
    await seedAccount(accountId);
    await repository.add(Session.create(accountId, 'hash-delete', '66666666-6666-4666-8666-666666666666', CREATED_AT));
    await repository.deleteByTokenHash('hash-delete');
    expect(await repository.findByTokenHash('hash-delete')).toBeNull();
  });

  it('deletes every session for an account', async () => {
    const accountId = '77777777-7777-4777-8777-777777777777';
    await seedAccount(accountId);
    await repository.add(Session.create(accountId, 'hash-1', '88888888-8888-4888-8888-888888888888', CREATED_AT));
    await repository.add(Session.create(accountId, 'hash-2', '99999999-9999-4999-8999-999999999999', CREATED_AT));
    await repository.deleteByAccountId(accountId);
    expect(await repository.findByTokenHash('hash-1')).toBeNull();
    expect(await repository.findByTokenHash('hash-2')).toBeNull();
  });
});
