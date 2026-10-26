import { describe, expect, it } from 'vitest';
import { Account, type AccountRole } from '../domain/account.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { SeedSystemAdmins } from './seed-system-admins.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

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

describe('SeedSystemAdmins', () => {
  it('makes each approved listed account a System Admin while there is none', async () => {
    const accounts = new InMemoryAccountRepository();
    await add(accounts, 'ada');
    await add(accounts, 'ben');
    await add(accounts, 'cy');

    const promoted = await new SeedSystemAdmins(accounts).execute({
      emails: ['ada@sourceone.global', 'ben@sourceone.global', 'nobody@sourceone.global'],
    });

    expect(promoted).toEqual(['ada@sourceone.global', 'ben@sourceone.global']);
    expect((await accounts.findById('ada'))?.role).toBe('system-admin');
    expect((await accounts.findById('ben'))?.role).toBe('system-admin');
    expect((await accounts.findById('cy'))?.role).toBe('staff');
  });

  it('skips a listed account that is pending or disabled', async () => {
    const accounts = new InMemoryAccountRepository();
    await add(accounts, 'ada', { approved: false });
    await accounts.save((await add(accounts, 'ben')).disable());

    const promoted = await new SeedSystemAdmins(accounts).execute({
      emails: ['ada@sourceone.global', 'ben@sourceone.global'],
    });

    expect(promoted).toEqual([]);
  });

  it('does nothing once a System Admin exists, so a demotion in the app holds', async () => {
    const accounts = new InMemoryAccountRepository();
    await add(accounts, 'ada', { role: 'system-admin' });
    await add(accounts, 'ben');

    const promoted = await new SeedSystemAdmins(accounts).execute({ emails: ['ben@sourceone.global'] });

    expect(promoted).toEqual([]);
    expect((await accounts.findById('ben'))?.role).toBe('staff');
  });

  it('promotes again when every System Admin is disabled', async () => {
    const accounts = new InMemoryAccountRepository();
    await accounts.save((await add(accounts, 'ada', { role: 'system-admin' })).disable());
    await add(accounts, 'ben');

    const promoted = await new SeedSystemAdmins(accounts).execute({ emails: ['ben@sourceone.global'] });

    expect(promoted).toEqual(['ben@sourceone.global']);
  });
});
