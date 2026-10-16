import type { Account, AccountLists, PasswordResetLink } from '../domain/account';

/**
 * Where the accounts feature talks to the API. The application owns this
 * port; infrastructure implements it over HTTP. Every method rejects with an
 * AppError.
 */
export interface AccountsGateway {
  signUp(input: { email: string; fullName: string; password: string }): Promise<Account>;
  signIn(input: { email: string; password: string }): Promise<Account>;
  signOut(): Promise<void>;
  me(): Promise<Account>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  resetPassword(input: { token: string; newPassword: string }): Promise<void>;
  listAccounts(): Promise<AccountLists>;
  approveAccount(id: string): Promise<Account>;
  disableAccount(id: string): Promise<Account>;
  createPasswordResetLink(id: string): Promise<PasswordResetLink>;
}
