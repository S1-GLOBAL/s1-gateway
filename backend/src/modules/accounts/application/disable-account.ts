import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { AccountNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import type { SessionRepository } from '../domain/session-repository.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface DisableAccountInput {
  accountId: string;
  /** The id of the admin disabling it. */
  disabledBy: string;
}

export type DisableAccountError = AccountNotFoundError | NotAllowedError;

/** Only a System Admin disables an admin's account, and nobody their own. */
export class DisableAccount implements UseCase<DisableAccountInput, Result<AccountDto, DisableAccountError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(input: DisableAccountInput): Promise<Result<AccountDto, DisableAccountError>> {
    const account = await this.accounts.findById(input.accountId);
    if (!account) return err(new AccountNotFoundError());
    const admin = await this.accounts.findById(input.disabledBy);
    if (!admin?.mayManage(account) || admin.id === account.id) return err(new NotAllowedError());

    const disabled = account.disable();
    await this.accounts.save(disabled);
    await this.sessions.deleteByAccountId(disabled.id);

    return ok(toAccountDto(disabled));
  }
}
