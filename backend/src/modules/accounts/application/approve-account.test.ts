import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { ApproveAccount } from './approve-account.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');
const APPROVED_AT = new Date('2026-10-16T09:00:00.000Z');

describe('ApproveAccount', () => {
  it('approves a pending account', async () => {
    const accounts = new InMemoryAccountRepository();
    const registered = Account.register(
      { email: 'staff@sourceone.global', fullName: 'Staff Member', passwordHash: 'hash', autoApprove: false },
      'account-1',
      CREATED_AT,
    );
    if (!registered.ok) throw new Error('setup failed');
    await accounts.add(registered.value);

    const result = await new ApproveAccount(accounts, new FixedClock(APPROVED_AT)).execute({
      accountId: 'account-1',
      approvedBy: 'admin-1',
    });

    expect(result.ok && result.value.status).toBe('approved');
    const [stored] = await accounts.list();
    expect(stored?.approvedBy).toBe('admin-1');
    expect(stored?.approvedAt?.toISOString()).toBe(APPROVED_AT.toISOString());
  });

  it('fails for an unknown account', async () => {
    const accounts = new InMemoryAccountRepository();
    const result = await new ApproveAccount(accounts, new FixedClock(APPROVED_AT)).execute({
      accountId: 'unknown',
      approvedBy: 'admin-1',
    });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
