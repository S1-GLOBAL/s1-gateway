import { describe, expect, it } from 'vitest';
import { Account, type AccountRole } from '../domain/account.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { Session } from '../domain/session.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { DisableAccount } from './disable-account.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

async function add(accounts: InMemoryAccountRepository, id: string, role: AccountRole = 'staff'): Promise<void> {
  const registered = Account.register(
    { email: `${id}@sourceone.global`, firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove: true, role },
    id,
    CREATED_AT,
  );
  await accounts.add(registered.value);
}

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  await add(accounts, 'account-1');
  await add(accounts, 'admin-1', 'admin');
  await add(accounts, 'admin-2', 'admin');
  await add(accounts, 'system-1', 'system-admin');
  await sessions.add(Session.create('account-1', 'hash(token-1)', 'session-1', CREATED_AT));
  await sessions.add(Session.create('account-1', 'hash(token-2)', 'session-2', CREATED_AT));
  return { accounts, sessions, disableAccount: new DisableAccount(accounts, sessions) };
}

describe('DisableAccount', () => {
  it('disables the account and ends every open session', async () => {
    const { accounts, sessions, disableAccount } = await setup();
    const result = await disableAccount.execute({ accountId: 'account-1', disabledBy: 'admin-1' });
    expect(result.ok && result.value.status).toBe('disabled');

    expect((await accounts.findById('account-1'))?.status).toBe('disabled');
    expect(await sessions.findByTokenHash('hash(token-1)')).toBeNull();
    expect(await sessions.findByTokenHash('hash(token-2)')).toBeNull();
  });

  it("refuses an admin disabling another admin's or a System Admin's account", async () => {
    const { accounts, disableAccount } = await setup();
    for (const accountId of ['admin-2', 'system-1']) {
      const result = await disableAccount.execute({ accountId, disabledBy: 'admin-1' });
      expect(!result.ok && result.error).toBeInstanceOf(NotAllowedError);
      expect((await accounts.findById(accountId))?.status).toBe('approved');
    }
  });

  it("lets a System Admin disable an admin's account", async () => {
    const { disableAccount } = await setup();
    const result = await disableAccount.execute({ accountId: 'admin-2', disabledBy: 'system-1' });
    expect(result.ok && result.value.status).toBe('disabled');
  });

  it('refuses anyone disabling their own account', async () => {
    const { disableAccount } = await setup();
    const result = await disableAccount.execute({ accountId: 'system-1', disabledBy: 'system-1' });
    expect(!result.ok && result.error).toBeInstanceOf(NotAllowedError);
  });

  it('fails for an unknown account', async () => {
    const { disableAccount } = await setup();
    const result = await disableAccount.execute({ accountId: 'unknown', disabledBy: 'admin-1' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
