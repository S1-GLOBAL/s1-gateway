import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface ApproveAccountInput {
  accountId: string;
  /** The id of the admin approving this account. */
  approvedBy: string;
}

export type ApproveAccountError = AccountNotFoundError | NotAllowedError;

/** Approves a pending account, or a disabled one again. Only a System Admin approves an admin's. */
export class ApproveAccount implements UseCase<ApproveAccountInput, Result<AccountDto, ApproveAccountError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ApproveAccountInput): Promise<Result<AccountDto, ApproveAccountError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return err(new AccountNotFoundError());
    const approver = await this.accounts.findById(input.approvedBy);
    if (!approver?.mayManage(account)) return err(new NotAllowedError());

    const approved = account.approve(input.approvedBy, this.clock.now());
    await this.accounts.save(approved);

    return ok(toAccountDto(approved));
  }
}
