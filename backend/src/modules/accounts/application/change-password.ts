import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { SignInRequiredError, WrongCurrentPasswordError } from '../domain/account.errors.js';
import { InvalidPasswordError, validatePassword } from '../domain/password.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';

export interface ChangePasswordInput {
  /** The raw session token from the cookie. */
  sessionToken: string;
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordError = SignInRequiredError | WrongCurrentPasswordError | InvalidPasswordError;

export class ChangePassword implements UseCase<ChangePasswordInput, Result<void, ChangePasswordError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangePasswordInput): Promise<Result<void, ChangePasswordError>> {
    const session = await this.sessions.findByTokenHash(this.tokens.hash(input.sessionToken));
    const now = this.clock.now();
    if (!session || session.isExpired(now)) return { ok: false, error: new SignInRequiredError() };

    const account = await this.accounts.findById(session.accountId);
    if (!account) return { ok: false, error: new SignInRequiredError() };

    const currentMatches = await this.passwordHasher.verify(input.currentPassword, account.passwordHash);
    if (!currentMatches) return { ok: false, error: new WrongCurrentPasswordError() };

    const newPassword = validatePassword(input.newPassword);
    if (!newPassword.ok) return newPassword;

    const passwordHash = await this.passwordHasher.hash(newPassword.value);
    await this.accounts.save(account.withPasswordHash(passwordHash, { clearMustChange: true }));
    // Drop every other device; keep this session so the person stays signed in.
    await this.sessions.deleteByAccountId(account.id);
    await this.sessions.add(session.renew(now));

    return ok(undefined);
  }
}
