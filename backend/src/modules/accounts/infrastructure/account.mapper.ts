import { Account, type AccountRole, type AccountStatus } from '../domain/account.js';
import { splitFullName, type PersonName } from '../domain/person-name.js';
import type { accounts } from './accounts.table.js';

type AccountRow = typeof accounts.$inferSelect;
type NewAccountRow = typeof accounts.$inferInsert;

export function toDomain(row: AccountRow): Account {
  return Account.restore({
    id: row.id,
    email: row.email,
    ...personNameOf(row),
    passwordHash: row.passwordHash,
    mustChangePassword: row.mustChangePassword,
    status: row.status as AccountStatus,
    role: row.role as AccountRole,
    failedSignInCount: row.failedSignInCount,
    lockedUntil: row.lockedUntil,
    createdAt: row.createdAt,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
  });
}

export function toRow(account: Account): NewAccountRow {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    firstName: account.firstName,
    lastName: account.lastName,
    passwordHash: account.passwordHash,
    mustChangePassword: account.mustChangePassword,
    status: account.status,
    role: account.role,
    failedSignInCount: account.failedSignInCount,
    lockedUntil: account.lockedUntil,
    createdAt: account.createdAt,
    approvedBy: account.approvedBy,
    approvedAt: account.approvedAt,
  };
}

/**
 * The row's first and last name. Both are empty only on an account the
 * previous release created after migration 0008 ran and before this code went
 * live: its name is split from `full_name` just as 0008 split every other.
 */
function personNameOf(row: AccountRow): PersonName {
  if (row.firstName === '' && row.lastName === '') return splitFullName(row.fullName);
  return { firstName: row.firstName, lastName: row.lastName };
}
