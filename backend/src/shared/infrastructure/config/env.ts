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
  ATLAS_REVIEW_SHEET_URL: z.url({ protocol: /^https$/, hostname: /^docs\.google\.com$/ }).optional(),
  ATLAS_REVIEW_SHEET_SYNC_KEY: z.string().min(1).optional(),
});

/** What the shared review sheet's sync needs (plan 0016): the spreadsheet, and the service account that writes to it. */
export interface ReviewSheetSyncConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  /** Lower-cased @sourceone.global addresses that may administer accounts. */
  accountAdminEmails: string[];
  /** The shared Google Sheet the Review sheet button opens (plan 0016); null when none is set. */
  atlasReviewSheetUrl: string | null;
  /** Atlas keeps the shared sheet in step when its service account's key is set; null when it is not. */
  atlasReviewSheetSync: ReviewSheetSyncConfig | null;
}

/**
 * The service account's JSON key file, as given: its text, or the text in
 * base64, which keeps a host's one-line variable safe. A message about it
 * never quotes it: it is a secret.
 */
function parseSyncKey(raw: string, sheetUrl: string | undefined): Result<ReviewSheetSyncConfig, string> {
  const name = 'ATLAS_REVIEW_SHEET_SYNC_KEY';
  const spreadsheetId = sheetUrl === undefined ? undefined : /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(new URL(sheetUrl).pathname)?.[1];
  if (spreadsheetId === undefined) {
    return err(`${name}: set ATLAS_REVIEW_SHEET_URL to the shared sheet's address too, https://docs.google.com/spreadsheets/d/<its id>/…`);
  }
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8');
  let key: unknown;
  try {
    key = JSON.parse(text);
  } catch {
    return err(`${name}: give the service account's JSON key file, or that file in base64`);
  }
  const { type, client_email: clientEmail, private_key: privateKey } = (key ?? {}) as Record<string, unknown>;
  if (type !== 'service_account' || typeof clientEmail !== 'string' || typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) {
    return err(`${name}: this is not a service account's JSON key: it needs type "service_account", client_email and private_key`);
  }
  return ok({ spreadsheetId, clientEmail, privateKey });
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

  const { ACCOUNT_ADMIN_EMAILS: _raw, ATLAS_REVIEW_SHEET_URL: sheet, ATLAS_REVIEW_SHEET_SYNC_KEY: syncKey, ...rest } = parsed.data;
  if (sheet !== undefined && !new URL(sheet).pathname.startsWith('/spreadsheets/')) {
    return err(["ATLAS_REVIEW_SHEET_URL: give the Google Sheet's address, https://docs.google.com/spreadsheets/d/…"]);
  }
  const sync = syncKey === undefined ? ok(null) : parseSyncKey(syncKey, sheet);
  if (!sync.ok) return err([sync.error]);
  return ok({ ...rest, accountAdminEmails: admins.value, atlasReviewSheetUrl: sheet ?? null, atlasReviewSheetSync: sync.value });
}
