import { AccountInvite } from '../domain/account-invite.js';
import type { accountInvites } from './accounts.table.js';

type AccountInviteRow = typeof accountInvites.$inferSelect;
type NewAccountInviteRow = typeof accountInvites.$inferInsert;

export function toDomain(row: AccountInviteRow): AccountInvite {
  return AccountInvite.restore({
    id: row.id,
    email: row.email,
    tokenHash: row.tokenHash,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    revokedAt: row.revokedAt,
  });
}

export function toRow(invite: AccountInvite): NewAccountInviteRow {
  return {
    id: invite.id,
    email: invite.email,
    tokenHash: invite.tokenHash,
    invitedBy: invite.invitedBy,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    revokedAt: invite.revokedAt,
  };
}
