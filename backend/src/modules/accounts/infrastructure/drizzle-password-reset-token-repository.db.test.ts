import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { Account } from '../domain/account.js';
import { PasswordResetToken } from '../domain/password-reset-token.js';
import { DrizzleAccountRepository } from './drizzle-account-repository.js';
import { DrizzlePasswordResetTokenRepository } from './drizzle-password-reset-token-repository.js';

const connection = connectTestDatabase();
const accountRepository = new DrizzleAccountRepository(connection.db);
const repository = new DrizzlePasswordResetTokenRepository(connection.db);
const CREATED_AT = new Date('2026-10-16T08:00:00.000Z');

async function seedAccount(id: string): Promise<void> {
  const result = Account.register(
    { email: `${id}@sourceone.global`, fullName: 'Staff Member', passwordHash: 'hash', autoApprove: true },
    id,
    CREATED_AT,
  );
  if (!result.ok) throw new Error('setup failed');
  await accountRepository.add(result.value);
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzlePasswordResetTokenRepository', () => {
  it('round-trips every field', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    await seedAccount(accountId);
    const token = PasswordResetToken.create(accountId, 'hash-abc', '22222222-2222-4222-8222-222222222222', CREATED_AT);
    await repository.add(token);

    const stored = await repository.findByTokenHash('hash-abc');
    expect(stored?.id).toBe(token.id);
    expect(stored?.accountId).toBe(accountId);
    expect(stored?.usedAt).toBeNull();
    expect(stored?.expiresAt.toISOString()).toBe(token.expiresAt.toISOString());
  });

  it('saves a token as used', async () => {
    const accountId = '33333333-3333-4333-8333-333333333333';
    await seedAccount(accountId);
    const token = PasswordResetToken.create(accountId, 'hash-use', '44444444-4444-4444-8444-444444444444', CREATED_AT);
    await repository.add(token);

    const usedAt = new Date('2026-10-16T09:00:00.000Z');
    await repository.save(token.use(usedAt));

    const stored = await repository.findByTokenHash('hash-use');
    expect(stored?.usedAt?.toISOString()).toBe(usedAt.toISOString());
  });

  it('deletes only unused tokens for the account', async () => {
    const accountId = '55555555-5555-4555-8555-555555555555';
    await seedAccount(accountId);
    const used = PasswordResetToken.create(accountId, 'hash-used', '66666666-6666-4666-8666-666666666666', CREATED_AT).use(
      CREATED_AT,
    );
    const unused = PasswordResetToken.create(accountId, 'hash-unused', '77777777-7777-4777-8777-777777777777', CREATED_AT);
    await repository.add(used);
    await repository.add(unused);

    await repository.deleteUnusedForAccount(accountId);

    expect(await repository.findByTokenHash('hash-unused')).toBeNull();
    expect(await repository.findByTokenHash('hash-used')).not.toBeNull();
  });
});
