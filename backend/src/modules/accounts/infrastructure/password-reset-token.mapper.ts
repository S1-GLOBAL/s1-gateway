import { PasswordResetToken } from '../domain/password-reset-token.js';
import type { passwordResetTokens } from './accounts.table.js';

type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
type NewPasswordResetTokenRow = typeof passwordResetTokens.$inferInsert;

export function toDomain(row: PasswordResetTokenRow): PasswordResetToken {
  return PasswordResetToken.restore({
    id: row.id,
    accountId: row.accountId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  });
}

export function toRow(token: PasswordResetToken): NewPasswordResetTokenRow {
  return {
    id: token.id,
    accountId: token.accountId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    usedAt: token.usedAt,
    createdAt: token.createdAt,
  };
}
