import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface ApproveAccountInput {
  accountId: string;
  /** The id of the admin approving this account. */
  approvedBy: string;
}

export class ApproveAccount implements UseCase<ApproveAccountInput, Result<AccountDto, AccountNotFoundError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ApproveAccountInput): Promise<Result<AccountDto, AccountNotFoundError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return { ok: false, error: new AccountNotFoundError() };

    const approved = account.approve(input.approvedBy, this.clock.now());
    await this.accounts.save(approved);

    return ok(toAccountDto(approved));
  }
}
