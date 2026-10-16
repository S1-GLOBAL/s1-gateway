import type { Response } from 'express';
import { SESSION_COOKIE } from './session-gate.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
}
