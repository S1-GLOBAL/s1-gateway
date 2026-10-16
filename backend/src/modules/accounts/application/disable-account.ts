import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import type { SessionRepository } from '../domain/session-repository.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface DisableAccountInput {
  accountId: string;
}

export class DisableAccount implements UseCase<DisableAccountInput, Result<AccountDto, AccountNotFoundError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(input: DisableAccountInput): Promise<Result<AccountDto, AccountNotFoundError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return { ok: false, error: new AccountNotFoundError() };

    const disabled = account.disable();
    await this.accounts.save(disabled);
    await this.sessions.deleteByAccountId(disabled.id);

    return ok(toAccountDto(disabled));
  }
}
