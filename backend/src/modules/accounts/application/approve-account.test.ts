import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account, type AccountRole } from '../domain/account.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { ApproveAccount } from './approve-account.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');
const APPROVED_AT = new Date('2026-10-16T09:00:00.000Z');

async function add(
  accounts: InMemoryAccountRepository,
  id: string,
  options: { role?: AccountRole; approved?: boolean } = {},
): Promise<Account> {
  const registered = Account.register(
    {
      email: `${id}@sourceone.global`,
      firstName: 'Staff',
      lastName: 'Member',
      passwordHash: 'hash',
      autoApprove: options.approved ?? true,
      role: options.role,
    },
    id,
    CREATED_AT,
  );
  await accounts.add(registered.value);
  return registered.value;
}

async function setup() {
  const accounts = new InMemoryAccountRepository();
  await add(accounts, 'admin-1', { role: 'admin' });
  await add(accounts, 'system-1', { role: 'system-admin' });
  return { accounts, approveAccount: new ApproveAccount(accounts, new FixedClock(APPROVED_AT)) };
}

describe('ApproveAccount', () => {
  it('approves a pending account', async () => {
    const { accounts, approveAccount } = await setup();
    await add(accounts, 'account-1', { approved: false });

    const result = await approveAccount.execute({ accountId: 'account-1', approvedBy: 'admin-1' });

    expect(result.ok && result.value.status).toBe('approved');
    const stored = await accounts.findById('account-1');
    expect(stored?.approvedBy).toBe('admin-1');
    expect(stored?.approvedAt?.toISOString()).toBe(APPROVED_AT.toISOString());
  });

  it("refuses an admin approving a disabled admin's account again, and leaves it disabled", async () => {
    const { accounts, approveAccount } = await setup();
    await accounts.save((await add(accounts, 'admin-2', { role: 'admin' })).disable());

    const result = await approveAccount.execute({ accountId: 'admin-2', approvedBy: 'admin-1' });

    expect(!result.ok && result.error).toBeInstanceOf(NotAllowedError);
    expect((await accounts.findById('admin-2'))?.status).toBe('disabled');
  });

  it("lets a System Admin approve a disabled admin's account again", async () => {
    const { accounts, approveAccount } = await setup();
    await accounts.save((await add(accounts, 'admin-2', { role: 'admin' })).disable());

    const result = await approveAccount.execute({ accountId: 'admin-2', approvedBy: 'system-1' });

    expect(result.ok && result.value.status).toBe('approved');
  });

  it('fails for an unknown account', async () => {
    const { approveAccount } = await setup();
    const result = await approveAccount.execute({ accountId: 'unknown', approvedBy: 'admin-1' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
