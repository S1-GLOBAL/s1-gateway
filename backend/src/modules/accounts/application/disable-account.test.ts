import { describe, expect, it } from 'vitest';
import { Account } from '../domain/account.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import { Session } from '../domain/session.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { DisableAccount } from './disable-account.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const registered = Account.register(
    { email: 'staff@sourceone.global', firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove: true },
    'account-1',
    CREATED_AT,
  );
  if (!registered.ok) throw new Error('setup failed');
  await accounts.add(registered.value);
  await sessions.add(Session.create('account-1', 'hash(token-1)', 'session-1', CREATED_AT));
  await sessions.add(Session.create('account-1', 'hash(token-2)', 'session-2', CREATED_AT));
  return { accounts, sessions, disableAccount: new DisableAccount(accounts, sessions) };
}

describe('DisableAccount', () => {
  it('disables the account and ends every open session', async () => {
    const { accounts, sessions, disableAccount } = await setup();
    const result = await disableAccount.execute({ accountId: 'account-1' });
    expect(result.ok && result.value.status).toBe('disabled');

    const [stored] = await accounts.list();
    expect(stored?.status).toBe('disabled');
    expect(await sessions.findByTokenHash('hash(token-1)')).toBeNull();
    expect(await sessions.findByTokenHash('hash(token-2)')).toBeNull();
  });

  it('fails for an unknown account', async () => {
    const accounts = new InMemoryAccountRepository();
    const sessions = new InMemorySessionRepository();
    const result = await new DisableAccount(accounts, sessions).execute({ accountId: 'unknown' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
