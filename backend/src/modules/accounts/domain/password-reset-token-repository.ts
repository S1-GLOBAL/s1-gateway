import type { PasswordResetToken } from './password-reset-token.js';

/** Where password reset tokens are kept. The domain owns this port; infrastructure implements it. */
export interface PasswordResetTokenRepository {
  add(token: PasswordResetToken): Promise<void>;

  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;

  save(token: PasswordResetToken): Promise<void>;

  /** Removes every unused token for the account — a new link makes prior ones unredeemable. */
  deleteUnusedForAccount(accountId: string): Promise<void>;
}
