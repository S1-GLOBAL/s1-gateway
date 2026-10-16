import { Account, type AccountStatus } from '../domain/account.js';
import type { accounts } from './accounts.table.js';

type AccountRow = typeof accounts.$inferSelect;
type NewAccountRow = typeof accounts.$inferInsert;

export function toDomain(row: AccountRow): Account {
  return Account.restore({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    mustChangePassword: row.mustChangePassword,
    status: row.status as AccountStatus,
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
    passwordHash: account.passwordHash,
    mustChangePassword: account.mustChangePassword,
    status: account.status,
    failedSignInCount: account.failedSignInCount,
    lockedUntil: account.lockedUntil,
    createdAt: account.createdAt,
    approvedBy: account.approvedBy,
    approvedAt: account.approvedAt,
  };
}
