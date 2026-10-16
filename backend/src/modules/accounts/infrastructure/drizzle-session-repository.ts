import { eq } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import type { Session } from '../domain/session.js';
import type { SessionRepository } from '../domain/session-repository.js';
import { sessions } from './accounts.table.js';
import { toDomain, toRow } from './session.mapper.js';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async add(session: Session): Promise<void> {
    await this.db.insert(sessions).values(toRow(session));
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash));
    return row ? toDomain(row) : null;
  }

  async save(session: Session): Promise<void> {
    await this.db.update(sessions).set(toRow(session)).where(eq(sessions.id, session.id));
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.accountId, accountId));
  }
}
