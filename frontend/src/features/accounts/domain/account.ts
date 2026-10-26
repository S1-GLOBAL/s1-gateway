export type AccountStatus = 'pending' | 'approved' | 'disabled';

/** An admin manages staff and invites; a System Admin manages everyone and changes roles (ADR 0030). */
export type AccountRole = 'staff' | 'admin' | 'system-admin';

export const ROLE_LABELS: Record<AccountRole, string> = {
  staff: 'Staff',
  admin: 'Admin',
  'system-admin': 'System Admin',
};

export interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** "First Last". */
  fullName: string;
  status: AccountStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  role: AccountRole;
  /** An admin or a System Admin. */
  isAdmin: boolean;
}

/*
 * The API's rules, so the Accounts page offers only what it would allow. The
 * API still decides: it refuses anything else with NOT_ALLOWED.
 */

/** Approving, disabling and resetting: an admin only staff, a System Admin anyone. */
export function mayManage(actor: Account, target: Account): boolean {
  return actor.role === 'system-admin' || (actor.role === 'admin' && target.role === 'staff');
}

/** A System Admin only, and never on their own account. */
export function mayChangeRoleOf(actor: Account, target: Account): boolean {
  return actor.role === 'system-admin' && actor.id !== target.id;
}

export interface AccountLists {
  pending: Account[];
  approved: Account[];
  disabled: Account[];
}

export interface PasswordResetLink {
  resetUrl: string;
  expiresAt: Date;
}

/** An unused invite, as the Invited section lists it. Never its token. */
export interface AccountInvite {
  id: string;
  email: string;
  expiresAt: Date;
}

/** A new invite and its link, shown to the admin once. */
export interface CreatedInvite {
  invite: AccountInvite;
  inviteUrl: string;
}

/** What the registration page shows before the account exists. */
export interface InviteDetails {
  email: string;
  expiresAt: Date;
}

/** The email is the invite's: none is sent. */
export interface Registration {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}
