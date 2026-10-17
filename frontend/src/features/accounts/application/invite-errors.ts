import { AppError } from '@/shared/application/app-error';

/** True when the API says the invite link is expired, used, revoked or unknown (404). */
export function isInviteInvalid(error: unknown): boolean {
  return error instanceof AppError && (error.code === 'INVITE_INVALID' || error.code === 'HTTP_404');
}
