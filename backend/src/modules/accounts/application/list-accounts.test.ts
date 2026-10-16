import { describe, expect, it } from 'vitest';
import { Account } from '../domain/account.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { ListAccounts } from './list-accounts.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

function account(id: string, firstName: string, lastName: string, autoApprove: boolean) {
  const result = Account.register(
    { email: `${id}@sourceone.global`, firstName, lastName, passwordHash: 'hash', autoApprove },
    id,
    CREATED_AT,
  );
  if (!result.ok) throw new Error('setup failed');
  return result.value;
}

describe('ListAccounts', () => {
  it('is empty before anything is added', async () => {
    const result = await new ListAccounts(new InMemoryAccountRepository()).execute();
    expect(result).toEqual({ pending: [], approved: [], disabled: [] });
  });

  it('groups accounts by status, sorted by full name', async () => {
    const accounts = new InMemoryAccountRepository();
    await accounts.add(account('1', 'Zed', 'Pending', false));
    await accounts.add(account('2', 'Amy', 'Pending', false));
    await accounts.add(account('3', 'Bob', 'Approved', true));
    await accounts.add(account('4', 'Cas', 'Disabled', true).disable());

    const result = await new ListAccounts(accounts).execute();
    expect(result.pending.map((a) => a.fullName)).toEqual(['Amy Pending', 'Zed Pending']);
    expect(result.approved.map((a) => a.fullName)).toEqual(['Bob Approved']);
    expect(result.disabled.map((a) => a.fullName)).toEqual(['Cas Disabled']);
  });
});
