import type { Request, Response } from 'express';
import type { Account as AccountContract, PasswordResetLink } from '../../../contracts/accounts.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { AccountDto } from '../application/account.dto.js';
import type { ApproveAccountInput } from '../application/approve-account.js';
import type {
  CreatePasswordResetLinkInput,
  CreatePasswordResetLinkOutput,
} from '../application/create-password-reset-link.js';
import type { DisableAccountInput } from '../application/disable-account.js';
import type { AccountsByStatus } from '../application/list-accounts.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import { requireAuth } from './session-gate.js';

function toContract(account: AccountDto, isAdmin: boolean): AccountContract {
  return { ...account, isAdmin };
}

export class AccountsController {
  constructor(
    private readonly listAccounts: UseCase<void, AccountsByStatus>,
    private readonly approveAccount: UseCase<
      ApproveAccountInput,
      Result<AccountDto, AccountNotFoundError>
    >,
    private readonly disableAccount: UseCase<
      DisableAccountInput,
      Result<AccountDto, AccountNotFoundError>
    >,
    private readonly createPasswordResetLink: UseCase<
      CreatePasswordResetLinkInput,
      Result<CreatePasswordResetLinkOutput, AccountNotFoundError>
    >,
    private readonly adminEmails: readonly string[],
    private readonly corsOrigin: string,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const lists = await this.listAccounts.execute();
    sendData(res, 200, {
      pending: lists.pending.map((account) => toContract(account, this.isAdmin(account.email))),
      approved: lists.approved.map((account) => toContract(account, this.isAdmin(account.email))),
      disabled: lists.disabled.map((account) => toContract(account, this.isAdmin(account.email))),
    });
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.approveAccount.execute({
      accountId: String(req.params.id),
      approvedBy: auth.account.id,
    });
    if (!result.ok) {
      throw new HttpError(404, result.error.code, result.error.message, result.error.details);
    }
    sendData(res, 200, toContract(result.value, this.isAdmin(result.value.email)));
  };

  disable = async (req: Request, res: Response): Promise<void> => {
    const result = await this.disableAccount.execute({ accountId: String(req.params.id) });
    if (!result.ok) {
      throw new HttpError(404, result.error.code, result.error.message, result.error.details);
    }
    sendData(res, 200, toContract(result.value, this.isAdmin(result.value.email)));
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const result = await this.createPasswordResetLink.execute({ accountId: String(req.params.id) });
    if (!result.ok) {
      throw new HttpError(404, result.error.code, result.error.message, result.error.details);
    }
    const origin = this.corsOrigin.replace(/\/$/, '');
    const body: PasswordResetLink = {
      resetUrl: `${origin}/reset-password?token=${encodeURIComponent(result.value.token)}`,
      expiresAt: result.value.expiresAt,
    };
    sendData(res, 200, body);
  };

  private isAdmin(email: string): boolean {
    return this.adminEmails.includes(email);
  }
}
