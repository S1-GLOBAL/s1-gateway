import type { Account, AccountStatus } from '../domain/account.js';

/** An account as the application hands it outward. Never a password hash or a token. */
export interface AccountDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** "First Last". */
  fullName: string;
  status: AccountStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

export function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    fullName: account.fullName,
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    createdAt: account.createdAt.toISOString(),
  };
}
