import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidPasswordError } from './account.errors.js';

export { InvalidPasswordError };

export const PASSWORD_MIN_LENGTH = 12;

/** Any characters are allowed; only length is checked. */
export function validatePassword(raw: string): Result<string, InvalidPasswordError> {
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return err(new InvalidPasswordError('Use at least 12 characters.'));
  }
  return ok(raw);
}
