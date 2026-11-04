import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway';
const ACCOUNT_ADMIN_EMAILS = 'admin@sourceone.global';

const required = { DATABASE_URL, ACCOUNT_ADMIN_EMAILS };

describe('parseEnv', () => {
  it('fills in defaults when only the database and admins are given', () => {
    expect(parseEnv(required)).toEqual({
      ok: true,
      value: {
        NODE_ENV: 'development',
        PORT: 4000,
        LOG_LEVEL: 'info',
        DATABASE_URL,
        CORS_ORIGIN: 'http://localhost:5173',
        accountAdminEmails: ['admin@sourceone.global'],
        atlasReviewSheetUrl: null,
        atlasReviewSheetSync: null,
      },
    });
  });

  it('reads the shared review sheet, a Google Sheet, and refuses any other address (plan 0016)', () => {
    const sheet = 'https://docs.google.com/spreadsheets/d/invented-sheet/edit';
    const read = parseEnv({ ...required, ATLAS_REVIEW_SHEET_URL: sheet });
    expect(read.ok && read.value.atlasReviewSheetUrl).toBe(sheet);

    for (const other of ['https://example.com/sheet', 'http://docs.google.com/spreadsheets/d/invented-sheet', 'https://docs.google.com/document/d/invented-doc']) {
      const refused = parseEnv({ ...required, ATLAS_REVIEW_SHEET_URL: other });
      expect(!refused.ok && refused.error.some((line) => line.startsWith('ATLAS_REVIEW_SHEET_URL'))).toBe(true);
    }
  });

  describe('ATLAS_REVIEW_SHEET_SYNC_KEY (plan 0016)', () => {
    const sheet = 'https://docs.google.com/spreadsheets/d/invented-sheet_1/edit#gid=0';
    // An invented key: its private key is a placeholder, never a real one.
    const privateKey = ['-----BEGIN PRIVATE KEY-----', 'invented', '-----END PRIVATE KEY-----', ''].join('\n');
    const keyFile = JSON.stringify({
      type: 'service_account',
      client_email: 'atlas-sheet-sync@invented-project.iam.gserviceaccount.com',
      private_key: privateKey,
    });
    const config = {
      spreadsheetId: 'invented-sheet_1',
      clientEmail: 'atlas-sheet-sync@invented-project.iam.gserviceaccount.com',
      privateKey,
    };

    it('reads the key file as text, or in base64, with the sheet it syncs', () => {
      for (const given of [keyFile, Buffer.from(keyFile).toString('base64')]) {
        const read = parseEnv({ ...required, ATLAS_REVIEW_SHEET_URL: sheet, ATLAS_REVIEW_SHEET_SYNC_KEY: given });
        expect(read.ok && read.value.atlasReviewSheetSync).toEqual(config);
      }
    });

    it("needs the sheet's address", () => {
      const read = parseEnv({ ...required, ATLAS_REVIEW_SHEET_SYNC_KEY: keyFile });
      expect(!read.ok && read.error[0]).toMatch(/^ATLAS_REVIEW_SHEET_SYNC_KEY: set ATLAS_REVIEW_SHEET_URL/);
    });

    it("refuses what is not a service account's key, and never quotes it", () => {
      const notKeys = ['not a key', Buffer.from('{"type":"authorized_user","client_secret":"invented-secret"}').toString('base64')];
      for (const given of notKeys) {
        const read = parseEnv({ ...required, ATLAS_REVIEW_SHEET_URL: sheet, ATLAS_REVIEW_SHEET_SYNC_KEY: given });
        expect(read.ok).toBe(false);
        const said = read.ok ? '' : read.error.join(' ');
        expect(said.startsWith('ATLAS_REVIEW_SHEET_SYNC_KEY')).toBe(true);
        expect(said).not.toContain('invented-secret');
        expect(said).not.toContain(given);
      }
    });
  });

  it('reads PORT as a number', () => {
    const result = parseEnv({ ...required, PORT: '8080' });
    expect(result.ok && result.value.PORT).toBe(8080);
  });

  it('splits, trims and lower-cases ACCOUNT_ADMIN_EMAILS', () => {
    const result = parseEnv({
      ...required,
      ACCOUNT_ADMIN_EMAILS: ' Rey@SourceOne.Global , other@sourceone.global ',
    });
    expect(result.ok && result.value.accountAdminEmails).toEqual([
      'rey@sourceone.global',
      'other@sourceone.global',
    ]);
  });

  it('names the missing variable', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });

  it('names ACCOUNT_ADMIN_EMAILS when it is missing', () => {
    const result = parseEnv({ DATABASE_URL });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects an empty entry in ACCOUNT_ADMIN_EMAILS', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'admin@sourceone.global,,other@sourceone.global' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects an admin email that is not @sourceone.global', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'admin@gmail.com' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects a subdomain of sourceone.global as an admin email', () => {
    const result = parseEnv({ ...required, ACCOUNT_ADMIN_EMAILS: 'a@mail.sourceone.global' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('ACCOUNT_ADMIN_EMAILS');
  });

  it('rejects a database URL that is not Postgres', () => {
    const result = parseEnv({ ...required, DATABASE_URL: 'mysql://localhost/s1' });
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });
});
