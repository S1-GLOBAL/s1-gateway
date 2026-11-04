/**
 * `npm --prefix backend run atlas:sheet-sync -- [--sheet "<a Google Sheet's address>"] [--write]`
 *
 * Syncs the shared review sheet with the library once, as the API does a
 * minute after a change (plan 0016). It writes nothing unless `--write` is
 * given: by default it says what a sync would change, cell by cell, so the
 * first sync of a sheet people have already reviewed in is seen before it is
 * made. `--sheet` syncs another sheet than `ATLAS_REVIEW_SHEET_URL`, such as a
 * copy to try it on first. The service account's key is
 * `ATLAS_REVIEW_SHEET_SYNC_KEY`, and the sheet must be shared with it as an
 * Editor. What it prints is Source One text: keep it out of anything public.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { LibraryReviewReport } from '../modules/atlas/application/library-review-report.js';
import { ReviewSheetSyncError } from '../modules/atlas/application/ports/review-spreadsheet.js';
import { SyncReviewSheet, type ReviewSheetSyncSummary } from '../modules/atlas/application/sync-review-sheet.js';
import { DrizzleDictionaryRepository } from '../modules/atlas/infrastructure/drizzle-dictionary-repository.js';
import { DrizzleImportedRowRepository } from '../modules/atlas/infrastructure/drizzle-imported-row-repository.js';
import { DrizzleSpecIdRepository } from '../modules/atlas/infrastructure/drizzle-spec-id-repository.js';
import { GoogleAccessToken } from '../modules/atlas/infrastructure/google-access-token.js';
import { GoogleReviewSpreadsheet } from '../modules/atlas/infrastructure/google-review-spreadsheet.js';
import { parseEnv } from '../shared/infrastructure/config/env.js';
import { connectDatabase } from '../shared/infrastructure/database/connection.js';

/** How many changed cells a dry run lists before it only counts the rest. */
const LISTED = 200;

/** What a sync did, or would do, in words. */
export function describeSync(summary: ReviewSheetSyncSummary): string {
  const did = summary.dryRun ? 'would' : 'did';
  const lines = [
    summary.dryRun ? 'Dry run: nothing was written to the sheet.' : 'Synced the shared review sheet.',
    summary.madeRows
      ? `The Rows tab is missing: a sync ${did} make it whole, ${summary.added} lines.`
      : [
          `Rows tab: ${summary.adopted} lines already on it taken as Atlas's, by their key written beside them;`,
          `  ${summary.updated} lines with a cell changed; ${summary.added} lines added below the last;`,
          `  ${summary.removed} lines marked "No longer in Atlas"; columns added: ${summary.columnsAdded.length === 0 ? 'none' : summary.columnsAdded.join(', ')}.`,
          '  Nothing under Correct?, What\'s wrong, Reviewer or Date, or in a column Atlas does not know, is written.',
        ].join('\n'),
    `Written whole: ${summary.rewritten.join(', ')}.`,
  ];
  if (summary.changes.length > 0) {
    lines.push('', `Cells on the Rows tab a sync ${did} change:`);
    for (const change of summary.changes.slice(0, LISTED)) {
      lines.push(`  row ${change.row}, ${change.column}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
    }
    if (summary.changes.length > LISTED) lines.push(`  …and ${summary.changes.length - LISTED} more.`);
  }
  return lines.join('\n');
}

const USAGE = 'Usage: npm --prefix backend run atlas:sheet-sync -- [--sheet "<https://docs.google.com/spreadsheets/d/…>"] [--write]';

async function main(): Promise<number> {
  config({ quiet: true });

  let values: { sheet?: string; write?: boolean };
  try {
    ({ values } = parseArgs({ options: { sheet: { type: 'string' }, write: { type: 'boolean', default: false } } }));
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  const environment = values.sheet === undefined ? process.env : { ...process.env, ATLAS_REVIEW_SHEET_URL: values.sheet };
  const env = parseEnv(environment);
  if (!env.ok) {
    console.error('Invalid environment — check backend/.env against backend/.env.example:');
    for (const line of env.error) console.error(`  ${line}`);
    return 1;
  }
  const sync = env.value.atlasReviewSheetSync;
  if (sync === null) {
    console.error(`Set ATLAS_REVIEW_SHEET_SYNC_KEY to the service account's key, and the sheet in ATLAS_REVIEW_SHEET_URL or --sheet.\n${USAGE}`);
    return 1;
  }

  const connection = connectDatabase(env.value.DATABASE_URL);
  try {
    const { db } = connection;
    const review = new LibraryReviewReport(new DrizzleDictionaryRepository(db), new DrizzleSpecIdRepository(db), new DrizzleImportedRowRepository(db));
    const sheet = new GoogleReviewSpreadsheet(sync.spreadsheetId, new GoogleAccessToken(sync), sync.clientEmail);
    const summary = await new SyncReviewSheet(review, sheet).execute({ dryRun: values.write !== true });
    console.log(describeSync(summary));
    return 0;
  } catch (error) {
    if (!(error instanceof ReviewSheetSyncError)) throw error;
    console.error(error.message);
    if (error.cause !== undefined) console.error(String(error.cause));
    return 1;
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
