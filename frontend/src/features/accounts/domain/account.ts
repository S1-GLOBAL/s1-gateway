export type AccountStatus = 'pending' | 'approved' | 'disabled';

export interface Account {
  id: string;
  email: string;
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
