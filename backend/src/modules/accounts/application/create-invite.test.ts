import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { InviteAccountExistsError, InviteEmailNotAllowedError } from '../domain/account.errors.js';
import { INVITE_TTL_MS } from '../domain/account-invite.js';
import { InMemoryAccountInviteRepository } from './testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { CreateInvite } from './create-invite.js';

const NOW = new Date('2026-10-17T09:00:00.000Z');
const ADMIN_ID = '00000000-0000-4000-8000-0000000000aa';

function setup() {
  const accounts = new InMemoryAccountRepository();
  const invites = new InMemoryAccountInviteRepository(accounts);
  const createInvite = new CreateInvite(
    accounts,
    invites,
    new FakeTokenGenerator(),
    new FixedClock(NOW),
    new SequentialIdGenerator(),
  );
  return { accounts, invites, createInvite };
}

async function addAccount(accounts: InMemoryAccountRepository, email: string) {
  const registered = Account.register(
    { email, firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'hash', autoApprove: true },
    'account-1',
    NOW,
  );
  await accounts.add(registered.value);
}

describe('CreateInvite', () => {
  it('creates a 7-day invite and reports its token unhashed', async () => {
    const { invites, createInvite } = setup();
    const result = await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });

    expect(result).toEqual({
      ok: true,
      value: {
        invite: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'ada@sourceone.global',
          expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS).toISOString(),
        },
        token: 'token-1',
      },
    });
    const stored = await invites.findByTokenHash('hash(token-1)');
    expect(stored?.invitedBy).toBe(ADMIN_ID);
    expect(stored?.isUsable(NOW)).toBe(true);
  });

  it('stores the email lower-cased and trimmed', async () => {
    const { invites, createInvite } = setup();
    await createInvite.execute({ email: '  Ada@SourceOne.Global ', invitedBy: ADMIN_ID });
    expect((await invites.findByTokenHash('hash(token-1)'))?.email).toBe('ada@sourceone.global');
  });

  it('refuses an address that is not @sourceone.global, with the invite form wording', async () => {
    const { invites, createInvite } = setup();
    const result = await createInvite.execute({ email: 'ada@gmail.com', invitedBy: ADMIN_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InviteEmailNotAllowedError);
      expect(result.error.code).toBe('EMAIL_NOT_ALLOWED');
      expect(result.error.message).toBe('Use a @sourceone.global email address.');
      expect(result.error.details).toEqual({ fields: { email: ['Use a @sourceone.global email address.'] } });
    }
    expect(await invites.listOpen(NOW)).toEqual([]);
  });

  it('refuses an address that already has an account, and creates no invite', async () => {
    const { accounts, invites, createInvite } = setup();
    await addAccount(accounts, 'ada@sourceone.global');
    const result = await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InviteAccountExistsError);
      expect(result.error.code).toBe('ACCOUNT_EXISTS');
      expect(result.error.message).toBe('An account already exists for that email.');
    }
    expect(await invites.listOpen(NOW)).toEqual([]);
  });

  it('finds the existing account whatever the case of the address typed', async () => {
    const { accounts, createInvite } = setup();
    await addAccount(accounts, 'ada@sourceone.global');
    const result = await createInvite.execute({ email: 'Ada@SourceOne.Global', invitedBy: ADMIN_ID });
    expect(!result.ok && result.error).toBeInstanceOf(InviteAccountExistsError);
  });

  it('replaces the open invite to the same email: the first link stops working', async () => {
    const { invites, createInvite } = setup();
    await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });
    await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });

    const first = await invites.findByTokenHash('hash(token-1)');
    expect(first?.revokedAt?.toISOString()).toBe(NOW.toISOString());
    expect(first?.isUsable(NOW)).toBe(false);
    expect((await invites.listOpen(NOW)).map((invite) => invite.tokenHash)).toEqual(['hash(token-2)']);
  });

  it('replaces the open invite whatever the case of the address typed', async () => {
    const { invites, createInvite } = setup();
    await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });
    await createInvite.execute({ email: 'Ada@SourceOne.Global', invitedBy: ADMIN_ID });
    expect((await invites.findByTokenHash('hash(token-1)'))?.isUsable(NOW)).toBe(false);
    expect(await invites.listOpen(NOW)).toHaveLength(1);
  });

  it('leaves the open invite to another email alone', async () => {
    const { invites, createInvite } = setup();
    await createInvite.execute({ email: 'ada@sourceone.global', invitedBy: ADMIN_ID });
    await createInvite.execute({ email: 'grace@sourceone.global', invitedBy: ADMIN_ID });
    expect(await invites.listOpen(NOW)).toHaveLength(2);
  });
});
