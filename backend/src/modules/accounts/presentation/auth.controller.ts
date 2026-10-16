import type { Request, Response } from 'express';
import type { Account as AccountContract } from '../../../contracts/accounts.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { AccountDto } from '../application/account.dto.js';
import type { ChangePasswordError, ChangePasswordInput } from '../application/change-password.js';
import type { GetMeInput } from '../application/get-me.js';
import type {
  ResetPasswordWithTokenError,
  ResetPasswordWithTokenInput,
} from '../application/reset-password-with-token.js';
import type { SignInError, SignInInput, SignInOutput } from '../application/sign-in.js';
import type { SignOutInput } from '../application/sign-out.js';
import type { SignUpError, SignUpInput } from '../application/sign-up.js';
import { SignInRequiredError } from '../domain/account.errors.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';
import {
  changePasswordRequestSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from './auth.schemas.js';
import { requireAuth, SESSION_COOKIE } from './session-gate.js';

const SIGN_UP_STATUS: Record<SignUpError['code'], number> = {
  EMAIL_NOT_ALLOWED: 400,
  VALIDATION_FAILED: 400,
  ACCOUNT_EXISTS: 409,
  SIGN_UP_RATE_LIMITED: 429,
};

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

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function toContract(account: AccountDto, isAdmin: boolean): AccountContract {
  return { ...account, isAdmin };
}

export class AuthController {
  constructor(
    private readonly signUp: UseCase<SignUpInput, Result<AccountDto, SignUpError>>,
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
    private readonly adminEmails: readonly string[],
    private readonly cookieSecure: boolean,
  ) {}

  signUpHandler = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(signUpRequestSchema, req.body);
    const result = await this.signUp.execute({
      ...body,
      clientIp: req.ip ?? 'unknown',
    });
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(SIGN_UP_STATUS[error.code], error.code, error.message, error.details);
    }
    sendData(res, 201, toContract(result.value, this.adminEmails.includes(result.value.email)));
  };

  signInHandler = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(signInRequestSchema, req.body);
    const result = await this.signIn.execute(body);
    if (!result.ok) {
      const { error } = result;
      throw new HttpError(SIGN_IN_STATUS[error.code], error.code, error.message, error.details);
    }
    setSessionCookie(res, result.value.sessionToken, this.cookieSecure);
    sendData(
      res,
      200,
      toContract(result.value.account, this.adminEmails.includes(result.value.account.email)),
    );
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
    sendData(res, 200, toContract(result.value, this.adminEmails.includes(result.value.email)));
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
}
