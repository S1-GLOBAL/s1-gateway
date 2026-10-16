import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidFullNameError } from './account.errors.js';

export { InvalidFullNameError };

export const FULL_NAME_MAX_LENGTH = 80;

export function normalizeFullName(raw: string): Result<string, InvalidFullNameError> {
  const fullName = raw.trim();
  if (fullName.length === 0) return err(new InvalidFullNameError('Enter First and Last name.'));
  if (fullName.length > FULL_NAME_MAX_LENGTH) {
    return err(new InvalidFullNameError('Use at most 80 characters.'));
  }
  return ok(fullName);
}
