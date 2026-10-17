import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidPersonNameError } from './account.errors.js';

export { InvalidPersonNameError };

/** Per part. Two of them, and the space between, make `full_name`'s 81. */
export const PERSON_NAME_MAX_LENGTH = 40;

export interface PersonName {
  firstName: string;
  lastName: string;
}

export function normalizeFirstName(raw: string): Result<string, InvalidPersonNameError> {
  return normalize(raw, 'firstName', 'Enter your first name.');
}

export function normalizeLastName(raw: string): Result<string, InvalidPersonNameError> {
  return normalize(raw, 'lastName', 'Enter your last name.');
}

/**
 * One full name as a first and a last name, exactly as migration 0008 split
 * every account's: before the first space, and the rest with its spaces
 * trimmed. Each part is cut to 40 characters, so a long name loses its end.
 */
export function splitFullName(fullName: string): PersonName {
  const space = fullName.indexOf(' ');
  if (space === -1) return { firstName: cut(fullName), lastName: '' };
  return {
    firstName: cut(fullName.slice(0, space)),
    lastName: trimSpaces(cut(trimSpaces(fullName.slice(space + 1)))),
  };
}

function normalize(
  raw: string,
  field: 'firstName' | 'lastName',
  emptyMessage: string,
): Result<string, InvalidPersonNameError> {
  const name = raw.trim();
  if (name.length === 0) return err(new InvalidPersonNameError(field, emptyMessage));
  // Characters, as varchar(40) counts them, not UTF-16 units.
  if (Array.from(name).length > PERSON_NAME_MAX_LENGTH) {
    return err(new InvalidPersonNameError(field, 'Use at most 40 characters.'));
  }
  return ok(name);
}

/** Postgres's `left(text, 40)`: whole characters, never half a surrogate pair. */
function cut(text: string): string {
  return Array.from(text).slice(0, PERSON_NAME_MAX_LENGTH).join('');
}

/** Postgres's `btrim(text)`: spaces only. */
function trimSpaces(text: string): string {
  return text.replace(/^ +| +$/g, '');
}
