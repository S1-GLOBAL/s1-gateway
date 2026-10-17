/**
 * `npm run db:create-admin -- --email <address> --first-name <name> --last-name <name>`,
 * with the password in `ADMIN_PASSWORD` for that one run.
 *
 * Creates an approved admin for local development and tests. With open
 * sign-up gone (ADR 0023) it is the only way into an empty database. It uses
 * the accounts module's own rules, repository and hasher, and never starts
 * the HTTP app. It refuses to run with `NODE_ENV=production`, and refuses an
 * address that is not in `ACCOUNT_ADMIN_EMAILS`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { Account } from '../modules/accounts/domain/account.js';
import { normalizeCompanyEmail } from '../modules/accounts/domain/email.js';
import { validatePassword } from '../modules/accounts/domain/password.js';
import { normalizeFirstName, normalizeLastName } from '../modules/accounts/domain/person-name.js';
import { DrizzleAccountRepository } from '../modules/accounts/infrastructure/drizzle-account-repository.js';
import { ScryptPasswordHasher } from '../modules/accounts/infrastructure/scrypt-password-hasher.js';
import { err, ok, type Result } from '../shared/domain/result.js';
import { parseEnv } from '../shared/infrastructure/config/env.js';
import { CryptoIdGenerator } from '../shared/infrastructure/crypto-id-generator.js';
import { connectDatabase, type Database } from '../shared/infrastructure/database/connection.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';

export interface CreateAdminInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  /** This run's `NODE_ENV`: `production` is refused. */
  nodeEnv: string | undefined;
  /** `ACCOUNT_ADMIN_EMAILS`, lower-cased, as the API reads it. */
  accountAdminEmails: readonly string[];
}

export interface CreatedAdmin {
  id: string;
  email: string;
  fullName: string;
}

const PRODUCTION_REFUSAL =
  'Refusing to run with NODE_ENV=production: create-admin is for local development and tests.';

/** Every refusal is one sentence, naming the option or variable to fix. Nothing is written unless it succeeds. */
export async function createAdmin(db: Database, input: CreateAdminInput): Promise<Result<CreatedAdmin, string>> {
  if (input.nodeEnv === 'production') return err(PRODUCTION_REFUSAL);

  const email = normalizeCompanyEmail(input.email);
  if (!email.ok) return err(`--email: ${email.error.message}`);
  if (!input.accountAdminEmails.includes(email.value)) {
    return err(`--email: ${email.value} is not in ACCOUNT_ADMIN_EMAILS, so it would not be an admin.`);
  }

  const firstName = normalizeFirstName(input.firstName);
  if (!firstName.ok) return err(`--first-name: ${firstName.error.message}`);

  const lastName = normalizeLastName(input.lastName);
  if (!lastName.ok) return err(`--last-name: ${lastName.error.message}`);

  const password = validatePassword(input.password);
  if (!password.ok) return err(`ADMIN_PASSWORD: ${password.error.message}`);

  const { value: account } = Account.register(
    {
      email: email.value,
      firstName: firstName.value,
      lastName: lastName.value,
      passwordHash: await new ScryptPasswordHasher().hash(password.value),
      autoApprove: true,
    },
    new CryptoIdGenerator().next(),
    new SystemClock().now(),
  );

  const added = await new DrizzleAccountRepository(db).add(account);
  if (!added.ok) return err(`--email: an account already exists for ${email.value}.`);

  return ok({ id: account.id, email: account.email, fullName: account.fullName });
}

const USAGE =
  'Usage: ADMIN_PASSWORD=<password> npm run db:create-admin -- --email <address> --first-name <name> --last-name <name>';

async function main(): Promise<number> {
  config({ quiet: true });
  // Before anything else, so a production host never gets as far as its database.
  if (process.env.NODE_ENV === 'production') {
    console.error(PRODUCTION_REFUSAL);
    return 1;
  }

  let values: { email?: string; 'first-name'?: string; 'last-name'?: string };
  try {
    ({ values } = parseArgs({
      options: {
        email: { type: 'string' },
        'first-name': { type: 'string' },
        'last-name': { type: 'string' },
      },
    }));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }

  const { email, 'first-name': firstName, 'last-name': lastName } = values;
  if (email === undefined || firstName === undefined || lastName === undefined) {
    console.error(`--email, --first-name and --last-name are all required.\n${USAGE}`);
    return 2;
  }

  // Read for this one run, never stored anywhere but as its hash.
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(`Set ADMIN_PASSWORD for this one run.\n${USAGE}`);
    return 2;
  }

  const env = parseEnv(process.env);
  if (!env.ok) {
    console.error('Invalid environment — check backend/.env against backend/.env.example:');
    for (const line of env.error) console.error(`  ${line}`);
    return 1;
  }

  const connection = connectDatabase(env.value.DATABASE_URL);
  try {
    const created = await createAdmin(connection.db, {
      email,
      firstName,
      lastName,
      password,
      nodeEnv: env.value.NODE_ENV,
      accountAdminEmails: env.value.accountAdminEmails,
    });
    if (!created.ok) {
      console.error(created.error);
      return 1;
    }
    console.log(`Created ${created.value.fullName} <${created.value.email}>, an approved admin. Sign in at ${env.value.CORS_ORIGIN}/sign-in.`);
    return 0;
  } finally {
    await connection.close();
  }
}

/** True when this file was run as the command, not imported by a test. */
function isCommand(): boolean {
  const entry = process.argv[1];
  // Windows paths may differ only in the drive letter's case.
  return entry !== undefined && resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (isCommand()) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
