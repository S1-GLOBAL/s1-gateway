import type { PasswordResetToken } from '../../domain/password-reset-token.js';
import type { PasswordResetTokenRepository } from '../../domain/password-reset-token-repository.js';

/** The PasswordResetTokenRepository contract, in memory. A test double, never used in production. */
export class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  private readonly tokens: PasswordResetToken[] = [];

  async add(token: PasswordResetToken): Promise<void> {
    this.tokens.push(token);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async save(token: PasswordResetToken): Promise<void> {
    const index = this.tokens.findIndex((existing) => existing.id === token.id);
    if (index === -1) throw new Error(`Password reset token ${token.id} was never added.`);
    this.tokens[index] = token;
  }

  async deleteUnusedForAccount(accountId: string): Promise<void> {
    for (let i = this.tokens.length - 1; i >= 0; i -= 1) {
      const token = this.tokens[i];
      if (token?.accountId === accountId && token.usedAt === null) this.tokens.splice(i, 1);
    }
  }
}
