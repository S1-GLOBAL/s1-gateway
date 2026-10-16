import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import {
  AccountDisabledError,
  AccountLockedError,
  AccountPendingError,
  SignInFailedError,
} from '../domain/account.errors.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { Session } from '../domain/session.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInOutput {
  account: AccountDto;
  /** The raw session token to set as the cookie's value. Never stored. */
  sessionToken: string;
}

export type SignInError = SignInFailedError | AccountPendingError | AccountDisabledError | AccountLockedError;

export class SignIn implements UseCase<SignInInput, Result<SignInOutput, SignInError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SignInInput): Promise<Result<SignInOutput, SignInError>> {
    const email = input.email.trim().toLowerCase();
    const account = await this.accounts.findByEmail(email);
    if (!account) return { ok: false, error: new SignInFailedError() };

    const now = this.clock.now();
    if (account.status === 'pending') return { ok: false, error: new AccountPendingError() };
    if (account.status === 'disabled') return { ok: false, error: new AccountDisabledError() };
    if (account.isLocked(now)) return { ok: false, error: new AccountLockedError() };

    const passwordMatches = await this.passwordHasher.verify(input.password, account.passwordHash);
    if (!passwordMatches) {
      const failed = account.recordFailedSignIn(now);
      await this.accounts.save(failed);
      return { ok: false, error: failed.isLocked(now) ? new AccountLockedError() : new SignInFailedError() };
    }

    const signedIn = account.recordSuccessfulSignIn();
    await this.accounts.save(signedIn);

    const sessionToken = this.tokens.generate();
    const session = Session.create(signedIn.id, this.tokens.hash(sessionToken), this.ids.next(), now);
    await this.sessions.add(session);

    return ok({ account: toAccountDto(signedIn), sessionToken });
  }
}
