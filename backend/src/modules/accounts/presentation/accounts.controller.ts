import type { Request, Response } from 'express';
import type {
  AccountInvite as AccountInviteContract,
  CreateInviteResponse,
  PasswordResetLink,
} from '../../../contracts/accounts.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { AccountDto } from '../application/account.dto.js';
import type { AccountInviteDto } from '../application/account-invite.dto.js';
import type { ApproveAccountError, ApproveAccountInput } from '../application/approve-account.js';
import type { CreateInviteError, CreateInviteInput, CreateInviteOutput } from '../application/create-invite.js';
import type {
  CreatePasswordResetLinkError,
  CreatePasswordResetLinkInput,
  CreatePasswordResetLinkOutput,
} from '../application/create-password-reset-link.js';
import type { DisableAccountError, DisableAccountInput } from '../application/disable-account.js';
import type { AccountsByStatus } from '../application/list-accounts.js';
import type { RevokeInviteInput } from '../application/revoke-invite.js';
import type { SetAccountRoleError, SetAccountRoleInput } from '../application/set-account-role.js';
import { AccountNotFoundError, InviteNotFoundError, NotAllowedError } from '../domain/account.errors.js';
import { toAccountContract } from './account-contract.js';
import { createInviteRequestSchema, inviteIdSchema, setAccountRoleRequestSchema } from './accounts.schemas.js';
import { requireAuth } from './session-gate.js';

/** Approving, disabling, resetting and changing a role all fail the same two ways. */
type AccountActionError = AccountNotFoundError | NotAllowedError;

const ACCOUNT_ACTION_STATUS: Record<AccountActionError['code'], number> = {
  ACCOUNT_NOT_FOUND: 404,
  NOT_ALLOWED: 403,
};

function toAccountActionError(error: AccountActionError): HttpError {
  return new HttpError(ACCOUNT_ACTION_STATUS[error.code], error.code, error.message, error.details);
}

const CREATE_INVITE_STATUS: Record<CreateInviteError['code'], number> = {
  EMAIL_NOT_ALLOWED: 400,
  ACCOUNT_EXISTS: 409,
};

/** The use cases behind the admin's invite routes. */
export interface InviteUseCases {
  create: UseCase<CreateInviteInput, Result<CreateInviteOutput, CreateInviteError>>;
  list: UseCase<void, AccountInviteDto[]>;
  revoke: UseCase<RevokeInviteInput, Result<AccountInviteDto, InviteNotFoundError>>;
}

function toInviteContract(invite: AccountInviteDto): AccountInviteContract {
  return { id: invite.id, email: invite.email, expiresAt: invite.expiresAt };
}

function toNotFound(error: InviteNotFoundError): HttpError {
  return new HttpError(404, error.code, error.message, error.details);
}

export class AccountsController {
  constructor(
    private readonly listAccounts: UseCase<void, AccountsByStatus>,
    private readonly approveAccount: UseCase<ApproveAccountInput, Result<AccountDto, ApproveAccountError>>,
    private readonly disableAccount: UseCase<DisableAccountInput, Result<AccountDto, DisableAccountError>>,
    private readonly createPasswordResetLink: UseCase<
      CreatePasswordResetLinkInput,
      Result<CreatePasswordResetLinkOutput, CreatePasswordResetLinkError>
    >,
    private readonly setAccountRole: UseCase<SetAccountRoleInput, Result<AccountDto, SetAccountRoleError>>,
    private readonly corsOrigin: string,
    private readonly invites: InviteUseCases,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const lists = await this.listAccounts.execute();
    sendData(res, 200, {
      pending: lists.pending.map(toAccountContract),
      approved: lists.approved.map(toAccountContract),
      disabled: lists.disabled.map(toAccountContract),
    });
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.approveAccount.execute({
      accountId: String(req.params.id),
      approvedBy: auth.account.id,
    });
    if (!result.ok) throw toAccountActionError(result.error);
    sendData(res, 200, toAccountContract(result.value));
  };

  disable = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.disableAccount.execute({ accountId: String(req.params.id), disabledBy: auth.account.id });
    if (!result.ok) throw toAccountActionError(result.error);
    sendData(res, 200, toAccountContract(result.value));
  };

  setRole = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const body = parseBody(setAccountRoleRequestSchema, req.body);
    const result = await this.setAccountRole.execute({
      accountId: String(req.params.id),
      role: body.role,
      changedBy: auth.account.id,
    });
    if (!result.ok) throw toAccountActionError(result.error);
    sendData(res, 200, toAccountContract(result.value));
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.createPasswordResetLink.execute({
      accountId: String(req.params.id),
      requestedBy: auth.account.id,
    });
    if (!result.ok) throw toAccountActionError(result.error);
    const body: PasswordResetLink = {
      resetUrl: `${this.origin()}/reset-password?token=${encodeURIComponent(result.value.token)}`,
      expiresAt: result.value.expiresAt,
    };
    sendData(res, 200, body);
  };

  createInvite = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const body = parseBody(createInviteRequestSchema, req.body);
    const result = await this.invites.create.execute({ email: body.email, invitedBy: auth.account.id });
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(CREATE_INVITE_STATUS[error.code], error.code, error.message, error.details);
    }
    const created: CreateInviteResponse = {
      invite: toInviteContract(result.value.invite),
      inviteUrl: `${this.origin()}/register?token=${encodeURIComponent(result.value.token)}`,
    };
    sendData(res, 201, created);
  };

  listInvites = async (_req: Request, res: Response): Promise<void> => {
    const invites = await this.invites.list.execute();
    sendData(res, 200, invites.map(toInviteContract));
  };

  revokeInvite = async (req: Request, res: Response): Promise<void> => {
    // Anything that is not an id names no invite: 404, before any query.
    const id = inviteIdSchema.safeParse(req.params.id);
    if (!id.success) throw toNotFound(new InviteNotFoundError());
    const result = await this.invites.revoke.execute({ inviteId: id.data });
    if (!result.ok) throw toNotFound(result.error);
    sendData(res, 200, toInviteContract(result.value));
  };

  /** The SPA's origin, where the reset and invite links open. */
  private origin(): string {
    return this.corsOrigin.replace(/\/$/, '');
  }
}
