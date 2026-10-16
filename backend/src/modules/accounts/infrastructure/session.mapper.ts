import { Session } from '../domain/session.js';
import type { sessions } from './accounts.table.js';

type SessionRow = typeof sessions.$inferSelect;
type NewSessionRow = typeof sessions.$inferInsert;

export function toDomain(row: SessionRow): Session {
  return Session.restore({
    id: row.id,
    accountId: row.accountId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
  });
}

export function toRow(session: Session): NewSessionRow {
  return {
    id: session.id,
    accountId: session.accountId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    createdAt: session.createdAt,
  };
}
