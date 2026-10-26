import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { PasswordResetToken } from '../domain/password-reset-token.js';
import type { PasswordResetTokenRepository } from '../domain/password-reset-token-repository.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface CreatePasswordResetLinkInput {
  accountId: string;
  /** The id of the admin asking for the link. */
  requestedBy: string;
}

export interface CreatePasswordResetLinkOutput {
  account: AccountDto;
  /** The raw token for the admin's link. Never stored. */
  token: string;
  expiresAt: string;
}

export type CreatePasswordResetLinkError = AccountNotFoundError | NotAllowedError;

/** Only a System Admin resets an admin's password. */
export class CreatePasswordResetLink
  implements UseCase<CreatePasswordResetLinkInput, Result<CreatePasswordResetLinkOutput, CreatePasswordResetLinkError>>
{
  constructor(
    private readonly accounts: AccountRepository,
    private readonly resetTokens: PasswordResetTokenRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreatePasswordResetLinkInput,
  ): Promise<Result<CreatePasswordResetLinkOutput, CreatePasswordResetLinkError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return err(new AccountNotFoundError());
    const admin = await this.accounts.findById(input.requestedBy);
    if (!admin?.mayManage(account)) return err(new NotAllowedError());

    // A new link makes every prior unused one unredeemable, and ends any
    // session the account currently holds.
    await this.resetTokens.deleteUnusedForAccount(account.id);
    await this.sessions.deleteByAccountId(account.id);

    const now = this.clock.now();
    const token = this.tokens.generate();
    const resetToken = PasswordResetToken.create(account.id, this.tokens.hash(token), this.ids.next(), now);
    await this.resetTokens.add(resetToken);

    return ok({ account: toAccountDto(account), token, expiresAt: resetToken.expiresAt.toISOString() });
  }
}
