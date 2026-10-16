import { z } from 'zod';
import { err, ok, type Result } from '../../domain/result.js';

/** Exact company mailbox — no subdomains (mail.sourceone.global) and no suffix tricks. */
const COMPANY_EMAIL = /^[^@]+@sourceone\.global$/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  ACCOUNT_ADMIN_EMAILS: z.string().min(1),
});

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  /** Lower-cased @sourceone.global addresses that may administer accounts. */
  accountAdminEmails: string[];
}

function parseAccountAdminEmails(raw: string): Result<string[], string> {
  const emails = raw.split(',').map((part) => part.trim().toLowerCase());
  if (emails.length === 0 || emails.some((email) => email.length === 0)) {
    return err('ACCOUNT_ADMIN_EMAILS: list at least one @sourceone.global address (empty entries are not allowed)');
  }
  for (const email of emails) {
    if (!COMPANY_EMAIL.test(email)) {
      return err(
        `ACCOUNT_ADMIN_EMAILS: every address must be an @sourceone.global mailbox (got "${email}")`,
      );
    }
  }
  return ok(emails);
}

/**
 * Validated once, at boot. A bad value fails here with the variable's name,
 * not three layers deep inside a request an hour later.
 */
export function parseEnv(source: Record<string, string | undefined>): Result<Env, string[]> {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }

  const admins = parseAccountAdminEmails(parsed.data.ACCOUNT_ADMIN_EMAILS);
  if (!admins.ok) return err([admins.error]);

  const { ACCOUNT_ADMIN_EMAILS: _raw, ...rest } = parsed.data;
  return ok({ ...rest, accountAdminEmails: admins.value });
}
