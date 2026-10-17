export type AccountStatus = 'pending' | 'approved' | 'disabled';

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
  isAdmin: boolean;
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
