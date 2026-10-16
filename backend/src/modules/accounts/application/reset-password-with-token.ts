import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { ResetTokenInvalidError } from '../domain/account.errors.js';
import { InvalidPasswordError, validatePassword } from '../domain/password.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import type { PasswordResetTokenRepository } from '../domain/password-reset-token-repository.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';

export interface ResetPasswordWithTokenInput {
  /** The raw token from the reset link. */
  token: string;
  newPassword: string;
}

export type ResetPasswordWithTokenError = ResetTokenInvalidError | InvalidPasswordError;

export class ResetPasswordWithToken
  implements UseCase<ResetPasswordWithTokenInput, Result<void, ResetPasswordWithTokenError>>
{
  constructor(
    private readonly accounts: AccountRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ResetPasswordWithTokenInput,
  ): Promise<Result<void, ResetPasswordWithTokenError>> {
    const resetToken = await this.resetTokens.findByTokenHash(this.tokens.hash(input.token));
    const now = this.clock.now();
    if (!resetToken || !resetToken.isUsable(now)) return { ok: false, error: new ResetTokenInvalidError() };

    const account = await this.accounts.findById(resetToken.accountId);
    if (!account) return { ok: false, error: new ResetTokenInvalidError() };

    const newPassword = validatePassword(input.newPassword);
    if (!newPassword.ok) return newPassword;

    const passwordHash = await this.passwordHasher.hash(newPassword.value);
    await this.accounts.save(account.withPasswordHash(passwordHash, { clearMustChange: true }));
    await this.resetTokens.save(resetToken.use(now));
    // Anyone who signed in with the old password after the link was created
    // must lose access the moment the new password lands.
    await this.sessions.deleteByAccountId(account.id);

    return ok(undefined);
  }
}
