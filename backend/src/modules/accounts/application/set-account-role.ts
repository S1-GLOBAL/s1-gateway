import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRole } from '../domain/account.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface SetAccountRoleInput {
  accountId: string;
  role: AccountRole;
  /** The id of the System Admin changing it. */
  changedBy: string;
}

export type SetAccountRoleError = AccountNotFoundError | NotAllowedError;

/**
 * A System Admin promotes or demotes someone else (ADR 0030). The role is
 * read on every request, so it takes effect on the next one: no session ends.
 */
export class SetAccountRole implements UseCase<SetAccountRoleInput, Result<AccountDto, SetAccountRoleError>> {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: SetAccountRoleInput): Promise<Result<AccountDto, SetAccountRoleError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return err(new AccountNotFoundError());
    const systemAdmin = await this.accounts.findById(input.changedBy);
    if (!systemAdmin?.mayChangeRoleOf(account)) return err(new NotAllowedError());

    const changed = account.withRole(input.role);
    await this.accounts.save(changed);

    return ok(toAccountDto(changed));
  }
}
