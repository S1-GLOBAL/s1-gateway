import type { Account, AccountLists, AccountsGateway } from '@/features/accounts';
import { AppError } from '@/shared/application/app-error';

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    email: 'ada@sourceone.global',
    fullName: 'Ada Lovelace',
    status: 'approved',
    mustChangePassword: false,
    createdAt: new Date(0),
    isAdmin: false,
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
    ...overrides,
  };
}