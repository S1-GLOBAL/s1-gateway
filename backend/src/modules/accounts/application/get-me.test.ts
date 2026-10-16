import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { SignInRequiredError } from '../domain/account.errors.js';
import { Session, SESSION_TTL_MS } from '../domain/session.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { GetMe } from './get-me.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

function approvedAccount() {
  const result = Account.register(
    { email: 'staff@sourceone.global', fullName: 'Staff Member', passwordHash: 'hash', autoApprove: true },
    'account-1',
    CREATED_AT,
  );
  if (!result.ok) throw new Error('setup failed');
  return result.value;
}

async function setup(now: Date) {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const account = approvedAccount();
  await accounts.add(account);
  await sessions.add(Session.create(account.id, 'hash(token-1)', 'session-1', CREATED_AT));
  const getMe = new GetMe(accounts, sessions, new FakeTokenGenerator(), new FixedClock(now));
  return { accounts, sessions, getMe, account };
}

describe('GetMe', () => {
  it('returns the account for a valid session', async () => {
    const { getMe } = await setup(CREATED_AT);
    const result = await getMe.execute({ sessionToken: 'token-1' });
    expect(result.ok && result.value.email).toBe('staff@sourceone.global');
  });

  it('renews the session on a request within the 7-day window', async () => {
    const dayFive = new Date(CREATED_AT.getTime() + 5 * 24 * 60 * 60 * 1000);
    const { getMe, sessions } = await setup(dayFive);
    await getMe.execute({ sessionToken: 'token-1' });
    const session = await sessions.findByTokenHash('hash(token-1)');
    expect(session?.expiresAt.toISOString()).toBe(new Date(dayFive.getTime() + SESSION_TTL_MS).toISOString());
  });

  it('fails after the session has expired', async () => {
    const afterExpiry = new Date(CREATED_AT.getTime() + SESSION_TTL_MS + 1);
    const { getMe } = await setup(afterExpiry);
    const result = await getMe.execute({ sessionToken: 'token-1' });
    expect(!result.ok && result.error).toBeInstanceOf(SignInRequiredError);
  });

  it('fails for an unknown token', async () => {
    const { getMe } = await setup(CREATED_AT);
    const result = await getMe.execute({ sessionToken: 'nope' });
    expect(!result.ok && result.error).toBeInstanceOf(SignInRequiredError);
  });
});
