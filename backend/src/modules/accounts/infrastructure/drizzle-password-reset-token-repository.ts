import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import type { PasswordResetToken } from '../domain/password-reset-token.js';
import type { PasswordResetTokenRepository } from '../domain/password-reset-token-repository.js';
import { passwordResetTokens } from './accounts.table.js';
import { toDomain, toRow } from './password-reset-token.mapper.js';

export class DrizzlePasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: Database) {}

  async add(token: PasswordResetToken): Promise<void> {
    await this.db.insert(passwordResetTokens).values(toRow(token));
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    return row ? toDomain(row) : null;
  }

  async save(token: PasswordResetToken): Promise<void> {
    await this.db.update(passwordResetTokens).set(toRow(token)).where(eq(passwordResetTokens.id, token.id));
  }

  async deleteUnusedForAccount(accountId: string): Promise<void> {
    await this.db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.accountId, accountId), isNull(passwordResetTokens.usedAt)));
  }
}
