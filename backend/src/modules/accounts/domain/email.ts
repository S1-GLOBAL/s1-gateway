import { err, ok, type Result } from '../../../shared/domain/result.js';
import { EmailNotAllowedError } from './account.errors.js';

export { EmailNotAllowedError };

/** Exact company mailbox — no subdomains and no suffix tricks. */
const COMPANY_EMAIL = /^[^@]+@sourceone\.global$/i;

/** Trim, lower-case, and refuse anything that is not an @sourceone.global mailbox. */
export function normalizeCompanyEmail(raw: string): Result<string, EmailNotAllowedError> {
  const email = raw.trim().toLowerCase();
  if (!COMPANY_EMAIL.test(email)) return err(new EmailNotAllowedError());
  return ok(email);
}
