import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import {
  AccountExistsError,
  InvalidPasswordError,
  InvalidPersonNameError,
  InviteInvalidError,
  PasswordsDontMatchError,
} from '../domain/account.errors.js';
import { AccountInvite, INVITE_TTL_MS } from '../domain/account-invite.js';
import { InMemoryAccountInviteRepository } from './testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { FakePasswordHasher } from './testing/fake-password-hasher.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { RegisterWithInvite } from './register-with-invite.js';

const CREATED_AT = new Date('2026-10-17T08:00:00.000Z');
const NOW = new Date('2026-10-17T09:00:00.000Z');
const ADMIN_ID = '00000000-0000-4000-8000-0000000000aa';
const EMAIL = 'ada@sourceone.global';

const input = {
  token: 'token-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  password: '123456789012',
  confirmPassword: '123456789012',
};

async function setup(
  options: { now?: Date; prepare?: (invite: AccountInvite) => AccountInvite } = {},
) {
  const accounts = new InMemoryAccountRepository();
  const invites = new InMemoryAccountInviteRepository(accounts);
  const created = AccountInvite.create(EMAIL, 'hash(token-1)', ADMIN_ID, 'invite-1', CREATED_AT);
  await invites.add(options.prepare ? options.prepare(created) : created);
  const register = new RegisterWithInvite(
    invites,
    new FakePasswordHasher(),
    new FakeTokenGenerator(),
    new FixedClock(options.now ?? NOW),
    new SequentialIdGenerator(),
  );
  return { accounts, invites, register };
}

async function expectNothingWritten(
  accounts: InMemoryAccountRepository,
  invites: InMemoryAccountInviteRepository,
) {
  expect(await accounts.list()).toEqual([]);
  expect((await invites.findByTokenHash('hash(token-1)'))?.usedAt ?? null).toBeNull();
}

describe('RegisterWithInvite', () => {
  it('creates an approved staff account with the email of the invite, named "First Last"', async () => {
    const { register } = await setup();
    const result = await register.execute(input);
    expect(result).toEqual({
      ok: true,
      value: {
        id: '00000000-0000-4000-8000-000000000001',
        email: EMAIL,
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
        status: 'approved',
        role: 'staff',
        mustChangePassword: false,
        createdAt: NOW.toISOString(),
      },
    });
  });

  it('records the inviting admin as the approver, and stores the password hashed', async () => {
    const { accounts, register } = await setup();
    await register.execute(input);
    const [stored] = await accounts.list();
    expect(stored?.approvedBy).toBe(ADMIN_ID);
    expect(stored?.approvedAt?.toISOString()).toBe(NOW.toISOString());
    expect(stored?.passwordHash).toBe(await new FakePasswordHasher().hash(input.password));
  });

  it('trims the names', async () => {
    const { accounts, register } = await setup();
    await register.execute({ ...input, firstName: '  Ada ', lastName: ' King Lovelace  ' });
    const [stored] = await accounts.list();
    expect(stored?.fullName).toBe('Ada King Lovelace');
  });

  it('marks the invite used, so the link works once', async () => {
    const { invites, register } = await setup();
    await register.execute(input);
    expect((await invites.findByTokenHash('hash(token-1)'))?.usedAt?.toISOString()).toBe(NOW.toISOString());

    const second = await register.execute(input);
    expect(!second.ok && second.error).toBeInstanceOf(InviteInvalidError);
  });

  it('refuses an expired, used, revoked or unknown token, and creates nothing', async () => {
    const cases = [
      await setup({ now: new Date(CREATED_AT.getTime() + INVITE_TTL_MS) }),
      await setup({ prepare: (invite) => invite.use(CREATED_AT) }),
      await setup({ prepare: (invite) => invite.revoke(CREATED_AT) }),
    ];
    for (const { accounts, register } of cases) {
      const result = await register.execute(input);
      expect(!result.ok && result.error).toBeInstanceOf(InviteInvalidError);
      expect(await accounts.list()).toEqual([]);
    }

    const { accounts, register } = await setup();
    const unknown = await register.execute({ ...input, token: 'not-a-token' });
    expect(!unknown.ok && unknown.error).toBeInstanceOf(InviteInvalidError);
    expect(await accounts.list()).toEqual([]);
  });

  it('refuses the first link once a second invite to the same email replaced it', async () => {
    const { invites, register } = await setup();
    await invites.add(AccountInvite.create(EMAIL, 'hash(token-2)', ADMIN_ID, 'invite-2', CREATED_AT));
    const result = await register.execute(input);
    expect(!result.ok && result.error).toBeInstanceOf(InviteInvalidError);
  });

  it('refuses passwords that differ, under confirmPassword, and writes nothing', async () => {
    const { accounts, invites, register } = await setup();
    const result = await register.execute({ ...input, confirmPassword: '123456789013' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PasswordsDontMatchError);
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.details).toEqual({ fields: { confirmPassword: ["The passwords don't match."] } });
    }
    await expectNothingWritten(accounts, invites);
  });

  it('refuses a password under 12 characters, and writes nothing', async () => {
    const { accounts, invites, register } = await setup();
    const result = await register.execute({ ...input, password: 'short', confirmPassword: 'short' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidPasswordError);
    await expectNothingWritten(accounts, invites);
  });

  it('accepts 40-character names', async () => {
    const { accounts, register } = await setup();
    const result = await register.execute({ ...input, firstName: 'A'.repeat(40), lastName: 'B'.repeat(40) });
    expect(result.ok).toBe(true);
    const [stored] = await accounts.list();
    expect(stored?.fullName).toBe(`${'A'.repeat(40)} ${'B'.repeat(40)}`);
  });

  it('refuses a 41-character first or last name, under that field, and writes nothing', async () => {
    const { accounts, invites, register } = await setup();
    const first = await register.execute({ ...input, firstName: 'A'.repeat(41) });
    expect(!first.ok && first.error.details).toEqual({ fields: { firstName: ['Use at most 40 characters.'] } });
    const last = await register.execute({ ...input, lastName: 'B'.repeat(41) });
    expect(!last.ok && last.error.details).toEqual({ fields: { lastName: ['Use at most 40 characters.'] } });
    await expectNothingWritten(accounts, invites);
  });

  it('refuses an empty first or last name', async () => {
    const { register } = await setup();
    const first = await register.execute({ ...input, firstName: '  ' });
    expect(!first.ok && first.error).toBeInstanceOf(InvalidPersonNameError);
    expect(!first.ok && first.error.message).toBe('Enter your first name.');
    const last = await register.execute({ ...input, lastName: '' });
    expect(!last.ok && last.error.message).toBe('Enter your last name.');
  });

  it('refuses when an account was created for the email since, leaving the invite unused', async () => {
    const { accounts, invites, register } = await setup();
    const existing = Account.register(
      { email: EMAIL, firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'hash', autoApprove: true },
      'account-0',
      CREATED_AT,
    );
    await accounts.add(existing.value);

    const result = await register.execute(input);

    expect(!result.ok && result.error).toBeInstanceOf(AccountExistsError);
    expect(await accounts.list()).toHaveLength(1);
    const invite = await invites.findByTokenHash('hash(token-1)');
    expect(invite?.usedAt).toBeNull();
    expect(invite?.isUsable(NOW)).toBe(true);
  });
});
