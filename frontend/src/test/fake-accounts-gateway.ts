import type { Account, AccountInvite, AccountLists, AccountsGateway } from '@/features/accounts';
import { AppError } from '@/shared/application/app-error';

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    email: 'ada@sourceone.global',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    status: 'approved',
    mustChangePassword: false,
    createdAt: new Date(0),
    isAdmin: false,
    ...overrides,
  };
}

export function invite(overrides: Partial<AccountInvite> = {}): AccountInvite {
  return {
    id: 'i1',
    email: 'grace@sourceone.global',
    expiresAt: new Date('2026-10-16T08:00:00.000Z'),
    ...overrides,
  };
}

export const SIGNED_OUT = new AppError('SIGN_IN_REQUIRED', 'Your session ended. Sign in again.');

/** Every method resolves with something plausible; a test overrides the ones it cares about. */
export function fakeAccountsGateway(overrides: Partial<AccountsGateway> = {}): AccountsGateway {
  const empty: AccountLists = { pending: [], approved: [], disabled: [] };
  return {
    signUp: async () => account({ status: 'pending' }),
    signIn: async () => account(),
    signOut: async () => undefined,
    me: async () => account(),
    changePassword: async () => undefined,
    resetPassword: async () => undefined,
    listAccounts: async () => empty,
    approveAccount: async () => account(),
    disableAccount: async () => account({ status: 'disabled' }),
    createPasswordResetLink: async () => ({
      resetUrl: 'https://gateway.example/reset-password?token=abc',
      expiresAt: new Date(0),
    }),
    createInvite: async (email) => ({
      invite: invite({ email }),
      inviteUrl: 'https://gateway.example/register?token=abc',
    }),
    listInvites: async () => [],
    revokeInvite: async (id) => invite({ id }),
    getInvite: async () => ({ email: 'ada@sourceone.global', expiresAt: new Date('2026-10-23T08:00:00.000Z') }),
    register: async () => account(),
    ...overrides,
  };
}
