import type { Request, RequestHandler } from 'express';
import type { Clock } from '../../../shared/application/ports/clock.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import type { Account } from '../domain/account.js';
import {
  MustChangePasswordError,
  NotAllowedError,
  SignInRequiredError,
} from '../domain/account.errors.js';
import type { Session } from '../domain/session.js';
import { SESSION_COOKIE, setSessionCookie } from './cookies.js';

export { SESSION_COOKIE };

export interface AuthenticatedRequest extends Request {
  auth: {
    account: Account;
    session: Session;
    /** Raw cookie value — needed by use cases that hash it again. */
    sessionToken: string;
  };
}

export interface SessionGateDeps {
  findSessionByTokenHash(tokenHash: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  findAccountById(id: string): Promise<Account | null>;
  hashToken(token: string): string;
  clock: Clock;
  /** Matches the Secure flag used when the cookie was first set. */
  cookieSecure: boolean;
}

/** Paths that a must-change account may still call while signed in. */
const MUST_CHANGE_ALLOWED = new Set([
  'GET /auth/me',
  'POST /auth/sign-out',
  'POST /auth/change-password',
]);

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function createSessionGate(deps: SessionGateDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (!token) throw toHttp(new SignInRequiredError(), 401);

      const session = await deps.findSessionByTokenHash(deps.hashToken(token));
      const now = deps.clock.now();
      if (!session || session.isExpired(now)) throw toHttp(new SignInRequiredError(), 401);

      const account = await deps.findAccountById(session.accountId);
      if (!account || account.status === 'disabled') throw toHttp(new SignInRequiredError(), 401);

      const renewed = session.renew(now);
      await deps.saveSession(renewed);
      // Refresh the browser maxAge so "renewed on each use" is not only server-side.
      setSessionCookie(res, token, deps.cookieSecure);

      (req as AuthenticatedRequest).auth = { account, session: renewed, sessionToken: token };

      if (account.mustChangePassword) {
        const key = `${req.method.toUpperCase()} ${req.path}`;
        if (!MUST_CHANGE_ALLOWED.has(key)) throw toHttp(new MustChangePasswordError(), 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Admins and System Admins pass. The role is the account's, read fresh by the session gate on every request. */
export function createAdminGate(): RequestHandler {
  return (req, _res, next) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.account.isAdmin) {
      next(toHttp(new NotAllowedError(), 403));
      return;
    }
    next();
  };
}

function toHttp(
  error: { code: string; message: string; details?: Record<string, unknown> },
  status: number,
): HttpError {
  return new HttpError(status, error.code, error.message, error.details);
}

export function requireAuth(req: Request): AuthenticatedRequest['auth'] {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) throw toHttp(new SignInRequiredError(), 401);
  return auth;
}
