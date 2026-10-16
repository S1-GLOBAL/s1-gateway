/** Wire shapes for auth and accounts. Types only — see contracts README. */

export type AccountStatus = 'pending' | 'approved' | 'disabled';

export interface Account {
  id: string;
  email: string;
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
