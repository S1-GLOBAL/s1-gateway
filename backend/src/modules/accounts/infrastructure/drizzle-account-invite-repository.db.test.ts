import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { CryptoIdGenerator } from '../../../shared/infrastructure/crypto-id-generator.js';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { RegisterWithInvite } from '../application/register-with-invite.js';
import { FakePasswordHasher } from '../application/testing/fake-password-hasher.js';
import { FakeTokenGenerator } from '../application/testing/fake-token-generator.js';
import { Account } from '../domain/account.js';
import { AccountExistsError, InviteInvalidError, InviteNotFoundError } from '../domain/account.errors.js';
import { AccountInvite, INVITE_TTL_MS } from '../domain/account-invite.js';
import { DrizzleAccountInviteRepository } from './drizzle-account-invite-repository.js';
import { DrizzleAccountRepository } from './drizzle-account-repository.js';

const connection = connectTestDatabase();
const accountRepository = new DrizzleAccountRepository(connection.db);
const repository = new DrizzleAccountInviteRepository(connection.db);
const ADMIN_ID = '00000000-0000-4000-8000-0000000000aa';
const CREATED_AT = new Date('2026-10-17T08:00:00.000Z');
const NOW = new Date('2026-10-17T09:00:00.000Z');
const EMAIL = 'ada@sourceone.global';

function invite(tokenHash: string, options: { email?: string; createdAt?: Date } = {}) {
  return AccountInvite.create(options.email ?? EMAIL, tokenHash, ADMIN_ID, randomUUID(), options.createdAt ?? CREATED_AT);
}

function invitedAccount(email = EMAIL) {
  return Account.registerInvited(
    { email, firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'hash', invitedBy: ADMIN_ID },
    randomUUID(),
    NOW,
  );
}

beforeEach(async () => {
  await resetTables(connection.db);
  const admin = Account.register(
    { email: 'admin@sourceone.global', firstName: 'Admin', lastName: '', passwordHash: 'hash', autoApprove: true },
    ADMIN_ID,
    CREATED_AT,
  );
  await accountRepository.add(admin.value);
});
afterAll(() => connection.close());

describe('DrizzleAccountInviteRepository', () => {
  it('round-trips every field', async () => {
    const created = invite('hash-abc');
    await repository.add(created);

    const stored = await repository.findByTokenHash('hash-abc');
    expect(stored?.id).toBe(created.id);
    expect(stored?.email).toBe(EMAIL);
    expect(stored?.invitedBy).toBe(ADMIN_ID);
    expect(stored?.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(stored?.expiresAt.toISOString()).toBe(new Date(CREATED_AT.getTime() + INVITE_TTL_MS).toISOString());
    expect(stored?.usedAt).toBeNull();
    expect(stored?.revokedAt).toBeNull();
  });

  it('returns null for an unknown token hash', async () => {
    expect(await repository.findByTokenHash('hash-unknown')).toBeNull();
  });

  it('revokes the open invite to the same email when another is added, and no other', async () => {
    await repository.add(invite('hash-first'));
    await repository.add(invite('hash-other', { email: 'grace@sourceone.global' }));
    const later = new Date('2026-10-17T08:30:00.000Z');
    await repository.add(invite('hash-second', { createdAt: later }));

    expect((await repository.findByTokenHash('hash-first'))?.revokedAt?.toISOString()).toBe(later.toISOString());
    expect((await repository.findByTokenHash('hash-other'))?.revokedAt).toBeNull();
    expect((await repository.findByTokenHash('hash-second'))?.revokedAt).toBeNull();
  });

  it('lists only open, unexpired invites, newest first', async () => {
    await repository.add(invite('hash-1', { email: 'one@sourceone.global', createdAt: new Date('2026-10-17T06:00:00.000Z') }));
    await repository.add(invite('hash-2', { email: 'two@sourceone.global', createdAt: new Date('2026-10-17T08:00:00.000Z') }));
    await repository.add(invite('hash-3', { email: 'three@sourceone.global', createdAt: new Date('2026-10-17T07:00:00.000Z') }));
    await repository.add(invite('hash-expired', { email: 'old@sourceone.global', createdAt: new Date(NOW.getTime() - INVITE_TTL_MS) }));
    const used = invite('hash-used', { email: 'used@sourceone.global' });
    await repository.add(used);
    await repository.redeem(used.id, invitedAccount('used@sourceone.global'), NOW);
    const revoked = invite('hash-revoked', { email: 'revoked@sourceone.global' });
    await repository.add(revoked);
    await repository.revoke(revoked.id, NOW);

    const open = await repository.listOpen(NOW);
    expect(open.map((stored) => stored.email)).toEqual([
      'two@sourceone.global',
      'three@sourceone.global',
      'one@sourceone.global',
    ]);
  });

  it('revokes an open invite once; a used, revoked or unknown one is not found', async () => {
    const open = invite('hash-open');
    await repository.add(open);
    const revoked = await repository.revoke(open.id, NOW);
    expect(revoked.ok && revoked.value.revokedAt?.toISOString()).toBe(NOW.toISOString());

    const again = await repository.revoke(open.id, NOW);
    expect(!again.ok && again.error).toBeInstanceOf(InviteNotFoundError);

    const used = invite('hash-used', { email: 'used@sourceone.global' });
    await repository.add(used);
    await repository.redeem(used.id, invitedAccount('used@sourceone.global'), NOW);
    const afterUse = await repository.revoke(used.id, NOW);
    expect(!afterUse.ok && afterUse.error).toBeInstanceOf(InviteNotFoundError);
    expect((await repository.findByTokenHash('hash-used'))?.revokedAt).toBeNull();

    const unknown = await repository.revoke(randomUUID(), NOW);
    expect(!unknown.ok && unknown.error).toBeInstanceOf(InviteNotFoundError);
  });

  it('redeems: adds the account and marks the invite used, together', async () => {
    const open = invite('hash-open');
    await repository.add(open);
    const account = invitedAccount();

    expect(await repository.redeem(open.id, account, NOW)).toEqual({ ok: true, value: undefined });

    expect((await repository.findByTokenHash('hash-open'))?.usedAt?.toISOString()).toBe(NOW.toISOString());
    const stored = await accountRepository.findByEmail(EMAIL);
    expect(stored?.id).toBe(account.id);
    expect(stored?.status).toBe('approved');
    expect(stored?.approvedBy).toBe(ADMIN_ID);
  });

  it('refuses to redeem an expired, used or revoked invite, adding nothing', async () => {
    const expired = invite('hash-expired', { email: 'expired@sourceone.global' });
    await repository.add(expired);
    const atExpiry = new Date(CREATED_AT.getTime() + INVITE_TTL_MS);
    const expiredResult = await repository.redeem(expired.id, invitedAccount('expired@sourceone.global'), atExpiry);
    expect(!expiredResult.ok && expiredResult.error).toBeInstanceOf(InviteInvalidError);

    const used = invite('hash-used', { email: 'used@sourceone.global' });
    await repository.add(used);
    await repository.redeem(used.id, invitedAccount('used@sourceone.global'), NOW);
    const usedResult = await repository.redeem(used.id, invitedAccount('used@sourceone.global'), NOW);
    expect(!usedResult.ok && usedResult.error).toBeInstanceOf(InviteInvalidError);

    const revoked = invite('hash-revoked', { email: 'revoked@sourceone.global' });
    await repository.add(revoked);
    await repository.revoke(revoked.id, NOW);
    const revokedResult = await repository.redeem(revoked.id, invitedAccount('revoked@sourceone.global'), NOW);
    expect(!revokedResult.ok && revokedResult.error).toBeInstanceOf(InviteInvalidError);

    expect((await accountRepository.list()).map((stored) => stored.email).sort()).toEqual([
      'admin@sourceone.global',
      'used@sourceone.global',
    ]);
  });

  it('rolls back when the email already has an account: ACCOUNT_EXISTS, invite unused', async () => {
    const open = invite('hash-open');
    await repository.add(open);
    await accountRepository.add(invitedAccount());

    const result = await repository.redeem(open.id, invitedAccount(), NOW);

    expect(!result.ok && result.error).toBeInstanceOf(AccountExistsError);
    expect((await repository.findByTokenHash('hash-open'))?.usedAt).toBeNull();
  });

  it('lets one of two simultaneous redeems of one invite win; the other is INVITE_INVALID', async () => {
    const open = invite('hash-open');
    await repository.add(open);

    const results = await Promise.all([
      repository.redeem(open.id, invitedAccount(), NOW),
      repository.redeem(open.id, invitedAccount(), NOW),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const lost = results.find((result) => !result.ok);
    expect(lost && !lost.ok && lost.error).toBeInstanceOf(InviteInvalidError);
    expect((await accountRepository.list()).filter((stored) => stored.email === EMAIL)).toHaveLength(1);
  });

  it('creates one account from two simultaneous registrations on one token; the other is INVITE_INVALID', async () => {
    await repository.add(invite('hash(token-1)'));
    const register = () =>
      new RegisterWithInvite(
        repository,
        new FakePasswordHasher(),
        new FakeTokenGenerator(),
        new FixedClock(NOW),
        new CryptoIdGenerator(),
      ).execute({
        token: 'token-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: '123456789012',
        confirmPassword: '123456789012',
      });

    const results = await Promise.all([register(), register()]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const lost = results.find((result) => !result.ok);
    expect(lost && !lost.ok && lost.error).toBeInstanceOf(InviteInvalidError);
    const accounts = await accountRepository.list();
    expect(accounts.filter((stored) => stored.email === EMAIL)).toHaveLength(1);
  });
});
