import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { SignInRequiredError } from '../domain/account.errors.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface GetMeInput {
  /** The raw session token from the cookie. */
  sessionToken: string;
}

export class GetMe implements UseCase<GetMeInput, Result<AccountDto, SignInRequiredError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetMeInput): Promise<Result<AccountDto, SignInRequiredError>> {
    const session = await this.sessions.findByTokenHash(this.tokens.hash(input.sessionToken));
    const now = this.clock.now();
    if (!session || session.isExpired(now)) return { ok: false, error: new SignInRequiredError() };

    const account = await this.accounts.findById(session.accountId);
    if (!account) return { ok: false, error: new SignInRequiredError() };

    await this.sessions.save(session.renew(now));

    return ok(toAccountDto(account));
  }
}
