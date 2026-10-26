import { describe, expect, it } from 'vitest';
import { Account, type AccountRole } from '../domain/account.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { SetAccountRole } from './set-account-role.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

async function add(accounts: InMemoryAccountRepository, id: string, role: AccountRole): Promise<void> {
  const registered = Account.register(
    { email: `${id}@sourceone.global`, firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove: true, role },
    id,
    CREATED_AT,
  );
  await accounts.add(registered.value);
}

async function setup() {
  const accounts = new InMemoryAccountRepository();
  await add(accounts, 'staff-1', 'staff');
  await add(accounts, 'admin-1', 'admin');
  await add(accounts, 'system-1', 'system-admin');
  await add(accounts, 'system-2', 'system-admin');
  return { accounts, setRole: new SetAccountRole(accounts) };
}

describe('SetAccountRole', () => {
  it('lets a System Admin promote staff to admin', async () => {
    const { accounts, setRole } = await setup();
    const result = await setRole.execute({ accountId: 'staff-1', role: 'admin', changedBy: 'system-1' });
    expect(result.ok && result.value.role).toBe('admin');
    expect((await accounts.findById('staff-1'))?.role).toBe('admin');
  });

  it('lets a System Admin demote an admin, and another System Admin', async () => {
    const { accounts, setRole } = await setup();
    await setRole.execute({ accountId: 'admin-1', role: 'staff', changedBy: 'system-1' });
    await setRole.execute({ accountId: 'system-2', role: 'admin', changedBy: 'system-1' });
    expect((await accounts.findById('admin-1'))?.role).toBe('staff');
    expect((await accounts.findById('system-2'))?.role).toBe('admin');
  });

  it('refuses an admin, and changes nothing', async () => {
    const { accounts, setRole } = await setup();
    const result = await setRole.execute({ accountId: 'staff-1', role: 'admin', changedBy: 'admin-1' });
    expect(!result.ok && result.error).toBeInstanceOf(NotAllowedError);
    expect((await accounts.findById('staff-1'))?.role).toBe('staff');
  });

  it('refuses a System Admin changing their own role', async () => {
    const { accounts, setRole } = await setup();
    const result = await setRole.execute({ accountId: 'system-1', role: 'staff', changedBy: 'system-1' });
    expect(!result.ok && result.error).toBeInstanceOf(NotAllowedError);
    expect((await accounts.findById('system-1'))?.role).toBe('system-admin');
  });

  it('fails for an unknown account', async () => {
    const { setRole } = await setup();
    const result = await setRole.execute({ accountId: 'unknown', role: 'admin', changedBy: 'system-1' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
