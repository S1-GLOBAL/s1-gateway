import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import { Account } from '../domain/account.js';
import { AccountExistsError, SignUpRateLimitedError } from '../domain/account.errors.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { EmailNotAllowedError, normalizeCompanyEmail } from '../domain/email.js';
import { InvalidFullNameError, normalizeFullName } from '../domain/full-name.js';
import { InvalidPasswordError, validatePassword } from '../domain/password.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import type { SignUpRateLimiter } from '../domain/sign-up-rate-limiter.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface SignUpInput {
  email: string;
  fullName: string;
  password: string;
  /** The requester's IP, for the per-IP hourly rate limit. */
  clientIp: string;
}

export type SignUpError =
  | EmailNotAllowedError
  | InvalidFullNameError
  | InvalidPasswordError
  | AccountExistsError
  | SignUpRateLimitedError;

export class SignUp implements UseCase<SignUpInput, Result<AccountDto, SignUpError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly rateLimiter: SignUpRateLimiter,
    private readonly passwordHasher: PasswordHasher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    /** Lower-cased @sourceone.global addresses that are auto-approved. */
    private readonly adminEmails: readonly string[],
  ) {}

  async execute(input: SignUpInput): Promise<Result<AccountDto, SignUpError>> {
    const email = normalizeCompanyEmail(input.email);
    if (!email.ok) return email;

    const password = validatePassword(input.password);
    if (!password.ok) return password;

    const fullName = normalizeFullName(input.fullName);
    if (!fullName.ok) return fullName;

    const existing = await this.accounts.findByEmail(email.value);
    if (existing) return { ok: false, error: new AccountExistsError() };

    const now = this.clock.now();
    const allowed = await this.rateLimiter.tryConsume(input.clientIp, now);
    if (!allowed) return { ok: false, error: new SignUpRateLimitedError() };

    const passwordHash = await this.passwordHasher.hash(password.value);
    const autoApprove = this.adminEmails.includes(email.value);
    const { value: account } = Account.register(
      { email: email.value, fullName: fullName.value, passwordHash, autoApprove },
      this.ids.next(),
      now,
    );

    const added = await this.accounts.add(account);
    if (!added.ok) return added;

    return ok(toAccountDto(account));
  }
}
