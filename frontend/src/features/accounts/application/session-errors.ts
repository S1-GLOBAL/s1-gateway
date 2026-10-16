import { AppError } from '@/shared/application/app-error';

/** True when the API says there is no valid session (401). */
export function isSignInRequired(error: unknown): boolean {
  return error instanceof AppError && (error.code === 'SIGN_IN_REQUIRED' || error.code === 'HTTP_401');
}

/** A 401 will not get better by asking again; anything else gets one more try. */
export function retryUnlessSignedOut(failureCount: number, error: unknown): boolean {
  return !isSignInRequired(error) && failureCount < 1;
}