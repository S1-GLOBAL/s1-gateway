/** Wire shapes for auth and accounts. Types only — see contracts README. */

export type AccountStatus = 'pending' | 'approved' | 'disabled';

export interface Account {
  id: string;
  email: string;
  firstName: string;
  /** Empty when a one-word full name was split into first and last. */
  lastName: string;
  /** "First Last". */
  fullName: string;
  status: AccountStatus;
  mustChangePassword: boolean;
  /** ISO 8601. */
  createdAt: string;
  /** Present on `/auth/me` when the caller is in ACCOUNT_ADMIN_EMAILS. */
  isAdmin?: boolean;
}

export interface SignUpRequest {
  email: string;
  fullName: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AccountLists {
  pending: Account[];
  approved: Account[];
  disabled: Account[];
}

export interface PasswordResetLink {
  resetUrl: string;
  /** ISO 8601. */
  expiresAt: string;
}

/** An unused invite, as the admin's Invited section lists it. Never its token. */
export interface AccountInvite {
  id: string;
  email: string;
  /** ISO 8601. */
  expiresAt: string;
}

export interface CreateInviteRequest {
  email: string;
}

export interface CreateInviteResponse {
  invite: AccountInvite;
  /** `{CORS_ORIGIN}/register?token=…` — shown once, never stored. */
  inviteUrl: string;
}

/** `GET /auth/invites/:token`: what the registration page shows before the account exists. */
export interface InviteDetails {
  email: string;
  /** ISO 8601. */
  expiresAt: string;
}

/** The email comes from the invite; one sent here is ignored. */
export interface RegisterRequest {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}
