import type { ErrorRequestHandler, Request, Response } from 'express';
import type { InviteDetails } from '../../../contracts/accounts.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { AccountDto } from '../application/account.dto.js';
import type { InviteDetailsDto } from '../application/account-invite.dto.js';
import type { ChangePasswordError, ChangePasswordInput } from '../application/change-password.js';
import type { GetInviteInput } from '../application/get-invite.js';
import type { GetMeInput } from '../application/get-me.js';
import type { RegisterWithInviteError, RegisterWithInviteInput } from '../application/register-with-invite.js';
import type {
  ResetPasswordWithTokenError,
  ResetPasswordWithTokenInput,
} from '../application/reset-password-with-token.js';
import type { SignInError, SignInInput, SignInOutput } from '../application/sign-in.js';
import type { SignOutInput } from '../application/sign-out.js';
import { InviteInvalidError, SignInRequiredError } from '../domain/account.errors.js';
import { toAccountContract } from './account-contract.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';
import {
  changePasswordRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
} from './auth.schemas.js';
import { requireAuth, SESSION_COOKIE } from './session-gate.js';

const SIGN_IN_STATUS: Record<SignInError['code'], number> = {
  SIGN_IN_FAILED: 401,
  ACCOUNT_PENDING: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_LOCKED: 423,
};

const CHANGE_PASSWORD_STATUS: Record<ChangePasswordError['code'], number> = {
  SIGN_IN_REQUIRED: 401,
  VALIDATION_FAILED: 400,
};

const RESET_STATUS: Record<ResetPasswordWithTokenError['code'], number> = {
  RESET_TOKEN_INVALID: 400,
  VALIDATION_FAILED: 400,
};

const REGISTER_STATUS: Record<RegisterWithInviteError['code'], number> = {
  INVITE_INVALID: 404,
  VALIDATION_FAILED: 400,
  ACCOUNT_EXISTS: 409,
};

/** The use cases behind the public invite routes: reading an invite, and registering with it. */
export interface PublicInviteUseCases {
  get: UseCase<GetInviteInput, Result<InviteDetailsDto, InviteInvalidError>>;
  register: UseCase<RegisterWithInviteInput, Result<AccountDto, RegisterWithInviteError>>;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export class AuthController {
  constructor(
    private readonly signIn: UseCase<SignInInput, Result<SignInOutput, SignInError>>,
    private readonly signOut: UseCase<SignOutInput, void>,
    private readonly getMe: UseCase<GetMeInput, Result<AccountDto, SignInRequiredError>>,
    private readonly changePassword: UseCase<
      ChangePasswordInput,
      Result<void, ChangePasswordError>
    >,
    private readonly resetPassword: UseCase<
      ResetPasswordWithTokenInput,
      Result<void, ResetPasswordWithTokenError>
    >,
    private readonly cookieSecure: boolean,
    private readonly invites: PublicInviteUseCases,
  ) {}

  signInHandler = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(signInRequestSchema, req.body);
    const result = await this.signIn.execute(body);
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(SIGN_IN_STATUS[error.code], error.code, error.message, error.details);
    }
    setSessionCookie(res, result.value.sessionToken, this.cookieSecure);
    sendData(res, 200, toAccountContract(result.value.account));
  };

  signOutHandler = async (req: Request, res: Response): Promise<void> => {
    const token = readCookie(req, SESSION_COOKIE) ?? '';
    await this.signOut.execute({ sessionToken: token });
    clearSessionCookie(res, this.cookieSecure);
    res.status(204).end();
  };

  meHandler = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.getMe.execute({ sessionToken: auth.sessionToken });
    if (!result.ok) {
      throw new HttpError(401, result.error.code, result.error.message, result.error.details);
    }
    sendData(res, 200, toAccountContract(result.value));
  };

  changePasswordHandler = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const body = parseBody(changePasswordRequestSchema, req.body);
    const result = await this.changePassword.execute({
      sessionToken: auth.sessionToken,
      ...body,
    });
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(CHANGE_PASSWORD_STATUS[error.code], error.code, error.message, error.details);
    }
    res.status(204).end();
  };

  resetPasswordHandler = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(resetPasswordRequestSchema, req.body);
    const result = await this.resetPassword.execute(body);
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(RESET_STATUS[error.code], error.code, error.message, error.details);
    }
    res.status(204).end();
  };

  getInviteHandler = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invites.get.execute({ token: String(req.params.token) });
    if (!result.ok) {
      throw new HttpError(404, result.error.code, result.error.message, result.error.details);
    }
    const details: InviteDetails = { email: result.value.email, expiresAt: result.value.expiresAt };
    sendData(res, 200, details);
  };

  /**
   * A token that is not even valid percent-encoding fails in Express's own
   * decoding, before any handler, as a URIError. It is just another unknown
   * token: the same 404, never a 400 or a 500.
   */
  undecodableInviteHandler: ErrorRequestHandler = (error, _req, _res, next) => {
    if (!(error instanceof URIError)) {
      next(error);
      return;
    }
    const invalid = new InviteInvalidError();
    next(new HttpError(404, invalid.code, invalid.message));
  };

  /** Creates the account but signs nobody in: no session cookie. The person signs in next. */
  registerHandler = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(registerRequestSchema, req.body);
    const result = await this.invites.register.execute(body);
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(REGISTER_STATUS[error.code], error.code, error.message, error.details);
    }
    sendData(res, 201, toAccountContract(result.value));
  };
}
