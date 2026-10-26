import type {
  Account,
  AccountInvite,
  AccountRole,
  AccountLists,
  CreatedInvite,
  InviteDetails,
  PasswordResetLink,
  Registration,
} from '../domain/account';

/**
 * Where the accounts feature talks to the API. The application owns this
 * port; infrastructure implements it over HTTP. Every method rejects with an
 * AppError.
 */
export interface AccountsGateway {
  signIn(input: { email: string; password: string }): Promise<Account>;
  signOut(): Promise<void>;
  me(): Promise<Account>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  resetPassword(input: { token: string; newPassword: string }): Promise<void>;
  listAccounts(): Promise<AccountLists>;
  approveAccount(id: string): Promise<Account>;
  disableAccount(id: string): Promise<Account>;
  createPasswordResetLink(id: string): Promise<PasswordResetLink>;
  /** System Admins only; rejects with NOT_ALLOWED on their own account. */
  setAccountRole(id: string, role: AccountRole): Promise<Account>;
  createInvite(email: string): Promise<CreatedInvite>;
  listInvites(): Promise<AccountInvite[]>;
  revokeInvite(id: string): Promise<AccountInvite>;
  /** Public: rejects with INVITE_INVALID when the link no longer works. */
  getInvite(token: string): Promise<InviteDetails>;
  /** Public: creates an approved account, but signs nobody in. */
  register(input: Registration): Promise<Account>;
}
