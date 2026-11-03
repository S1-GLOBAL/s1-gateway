/**
 * `npm --prefix backend run atlas:import -- --workbook "<path>" --report "<path>" --as <email> [--review "<path>.xlsx"] [--write]`
 *
 * Imports the verified list into Atlas (#28, #56, plan 0006, phases 3 and 4):
 * reads the workbook, builds a code for every product row, gathers each row's
 * manufacturer and quote, and writes a CSV report, and with `--review`, the
 * review workbook a department checks the codes in (plan 0013). It saves nothing unless
 * `--write` is given, and then saves Spec IDs only through the module's own
 * `SaveSpecId`, as the workspace saves, and replaces the quotes. It never starts the HTTP app. The
 * workbook, the report and the review workbook stay outside the repository (ADR 0027).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { DrizzleAccountRepository } from '../modules/accounts/infrastructure/drizzle-account-repository.js';
import { ImportVerifiedList } from '../modules/atlas/application/import-verified-list.js';
import { SaveSpecId } from '../modules/atlas/application/save-spec-id.js';
import type { ImportReport, ImportReportSink } from '../modules/atlas/application/ports/import-report-sink.js';
import { CsvImportReport } from '../modules/atlas/infrastructure/csv-import-report.js';
import { DrizzleDictionaryRepository } from '../modules/atlas/infrastructure/drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from '../modules/atlas/infrastructure/drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from '../modules/atlas/infrastructure/drizzle-spec-id-repository.js';
import { ExcelReviewWorkbook } from '../modules/atlas/infrastructure/excel-review-workbook.js';
import { ExcelVerifiedListSource } from '../modules/atlas/infrastructure/excel-verified-list-source.js';
import { err, ok, type Result } from '../shared/domain/result.js';
import { parseEnv } from '../shared/infrastructure/config/env.js';
import { CryptoIdGenerator } from '../shared/infrastructure/crypto-id-generator.js';
import { connectDatabase, type Database } from '../shared/infrastructure/database/connection.js';
import { SystemClock } from '../shared/infrastructure/system-clock.js';

export interface AtlasImportOptions {
  workbook: string;
  report: string;
  /** Where to write the review workbook (plan 0013), an `.xlsx` outside the repository; none when left out. */
  review?: string | undefined;
  /** The email of the staff account recorded as having saved each Spec ID. */
  as: string;
  write: boolean;
}

/**
 * Runs the import and answers #28's closing sentence, or a refusal. An
 * unknown or disabled `--as` account stops it before the workbook is read.
 */
export async function atlasImport(db: Database, options: AtlasImportOptions): Promise<Result<string, string>> {
  const email = options.as.trim().toLowerCase();
  const account = await new DrizzleAccountRepository(db).findByEmail(email);
  if (!account || account.status !== 'approved') return err(`No active staff account is ${email}. Nothing was imported.`);

  const dictionaries = new DrizzleDictionaryRepository(db);
  const specIds = new DrizzleSpecIdRepository(db);
  const sourcing = new DrizzleSourcingRepository(db);
  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const importer = new ImportVerifiedList(
    dictionaries,
    specIds,
    sourcing,
    new SaveSpecId(dictionaries, specIds, sourcing, clock, ids),
    new ExcelVerifiedListSource(options.workbook),
    sinkOf(options),
    clock,
    ids,
  );
  const summary = await importer.execute({ write: options.write, savedBy: { id: account.id, fullName: account.fullName } });

  const review = options.review === undefined ? '' : ` Review workbook: ${options.review}`;
  return ok(
    options.write
      ? `Saved ${summary.created} Spec IDs from ${summary.rows} rows; ${summary.alreadySaved} were already saved; ${summary.skipped} rows skipped. Report: ${options.report}${review}`
      : `Dry run: nothing was saved. ${summary.created} Spec IDs would be created from ${summary.rows} rows; ${summary.skipped} rows skipped. Report: ${options.report}${review}`,
  );
}

/** The CSV report, and the review workbook beside it when one is asked for. */
function sinkOf(options: AtlasImportOptions): ImportReportSink {
  const sinks: ImportReportSink[] = [new CsvImportReport(options.report)];
  if (options.review !== undefined) sinks.push(new ExcelReviewWorkbook(options.review));
  return {
    async write(report: ImportReport) {
      for (const sink of sinks) await sink.write(report);
    },
  };
}

const USAGE =
  'Usage: npm --prefix backend run atlas:import -- --workbook "<path>" --report "<path>" --as <email> [--review "<path>.xlsx"] [--write]';

async function main(): Promise<number> {
  config({ quiet: true });

  let values: { workbook?: string; report?: string; review?: string; as?: string; write?: boolean };
  try {
    ({ values } = parseArgs({
      options: {
        workbook: { type: 'string' },
        report: { type: 'string' },
        review: { type: 'string' },
        as: { type: 'string' },
        write: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }

  const { workbook, report, review, as, write = false } = values;
  if (workbook === undefined || report === undefined || as === undefined) {
    console.error(`--workbook, --report and --as are all required.\n${USAGE}`);
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
    const result = await atlasImport(connection.db, { workbook, report, review, as, write });
    if (!result.ok) {
      console.error(result.error);
      return 1;
    }
    console.log(result.value);
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
