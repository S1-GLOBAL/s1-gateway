import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ReviewSheetSyncError, type SheetTab } from '../application/ports/review-spreadsheet.js';
import type { LayoutTab } from '../application/review-sheet-layout.js';
import { GoogleAccessToken } from './google-access-token.js';
import { GoogleReviewSpreadsheet } from './google-review-spreadsheet.js';

/** An invented spreadsheet and service account: never the shared sheet's own. */
const SHEET_ID = 'invented-sheet-id';
const ACCOUNT = 'atlas-sheet-sync@invented-project.iam.gserviceaccount.com';

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A fetch that answers each call in turn, and keeps what was sent. */
function fetchAnswering(...answers: { status?: number; body: unknown }[]) {
  const sent: Sent[] = [];
  const fetchImpl = (async (url: string | URL | globalThis.Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    const answer = answers.shift() ?? { body: {} };
    return new Response(typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, sent };
}

function spreadsheet(...answers: { status?: number; body: unknown }[]) {
  const { fetchImpl, sent } = fetchAnswering(...answers);
  const sheet = new GoogleReviewSpreadsheet(SHEET_ID, { get: async () => 'invented-token' }, ACCOUNT, fetchImpl);
  return { sheet, sent, requests: (index: number) => (JSON.parse(sent[index]?.body ?? '{}') as { requests: Record<string, unknown>[] }).requests };
}

const ROWS: SheetTab = { id: 7, name: 'Rows', rows: 4, columns: 3 };

describe('GoogleAccessToken (plan 0016)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { clientEmail: ACCOUNT, privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };

  it('signs a claim for the spreadsheets scope alone, and keeps the token until a minute before it ends', async () => {
    const { fetchImpl, sent } = fetchAnswering({ body: { access_token: 'first', expires_in: 3600 } }, { body: { access_token: 'second', expires_in: 3600 } });
    let now = Date.parse('2026-11-04T08:00:00.000Z');
    const token = new GoogleAccessToken(key, fetchImpl, () => now);

    expect(await token.get()).toBe('first');
    now += 3_500_000;
    expect(await token.get()).toBe('first');
    now += 50_000;
    expect(await token.get()).toBe('second');

    expect(sent).toHaveLength(2);
    expect(sent[0]?.url).toBe('https://oauth2.googleapis.com/token');
    const assertion = new URLSearchParams(sent[0]?.body).get('assertion') ?? '';
    const [header = '', claims = '', signature = ''] = assertion.split('.');
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, signature, 'base64url')).toBe(true);
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toEqual({
      iss: ACCOUNT,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_793_779_200,
      exp: 1_793_782_800,
    });
  });

  it('says the key was refused, and keeps Google\'s answer for the log', async () => {
    const { fetchImpl } = fetchAnswering({ status: 400, body: { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' } });

    const failure = await new GoogleAccessToken(key, fetchImpl).get().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ReviewSheetSyncError);
    expect((failure as Error).message).toBe("Google refused Atlas's service account key: check ATLAS_REVIEW_SHEET_SYNC_KEY.");
    expect(String((failure as Error).cause)).toContain('Invalid JWT Signature.');
    expect((failure as Error).message).not.toContain('PRIVATE KEY');
  });
});

describe('GoogleReviewSpreadsheet (plan 0016)', () => {
  it('lists the tabs, with their size, by the token', async () => {
    const { sheet, sent } = spreadsheet({
      body: { sheets: [{ properties: { sheetId: 7, title: 'Rows', gridProperties: { rowCount: 1000, columnCount: 30 } } }, { properties: { sheetId: 9, title: 'Notes' } }] },
    });

    expect(await sheet.tabs()).toEqual([
      { id: 7, name: 'Rows', rows: 1000, columns: 30 },
      { id: 9, name: 'Notes', rows: 0, columns: 0 },
    ]);
    expect(sent[0]?.url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=`)).toBe(true);
    expect(sent[0]?.headers.authorization).toBe('Bearer invented-token');
  });

  it('reads a tab by its quoted name, each cell its text and note, an empty row empty', async () => {
    const { sheet, sent } = spreadsheet({
      body: { sheets: [{ data: [{ rowData: [{ values: [{ formattedValue: 'Row' }, { formattedValue: 'Code', note: 'A note' }] }, {}, { values: [{}, { formattedValue: 'A1B4' }] }] }] }] },
    });

    const grid = await sheet.read({ ...ROWS, name: "Ana's rows" });

    expect(grid).toEqual([
      [{ text: 'Row', note: '' }, { text: 'Code', note: 'A note' }],
      [],
      [{ text: '', note: '' }, { text: 'A1B4', note: '' }],
    ]);
    expect(new URL(sent[0]?.url ?? '').searchParams.get('ranges')).toBe("'Ana''s rows'");
  });

  it('makes a sync\'s changes in one request: columns first, then rows, values as values, never formulas', async () => {
    const { sheet, sent, requests } = spreadsheet({ body: {} });

    await sheet.editRows(ROWS, {
      insertColumns: [1, 4],
      writes: [
        { row: 2, column: 1, value: '=IMPORTRANGE("elsewhere")', note: '' },
        { row: 2, column: 2, value: 4, note: 'From Dimension' },
        { row: 5, column: 0, value: '', note: '' },
      ],
      rows: 6,
      verdicts: [{ row: 5, column: 3 }],
      hideColumns: [4],
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`);
    expect(requests(0)).toEqual([
      { insertDimension: { range: { sheetId: 7, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, inheritFromBefore: true } },
      // Past the last column, so added at the end.
      { appendDimension: { sheetId: 7, dimension: 'COLUMNS', length: 1 } },
      { appendDimension: { sheetId: 7, dimension: 'ROWS', length: 2 } },
      {
        updateCells: {
          start: { sheetId: 7, rowIndex: 2, columnIndex: 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '=IMPORTRANGE("elsewhere")' } }, { userEnteredValue: { numberValue: 4 }, note: 'From Dimension' }] }],
          fields: 'userEnteredValue,note',
        },
      },
      // An empty cell is cleared.
      { updateCells: { start: { sheetId: 7, rowIndex: 5, columnIndex: 0 }, rows: [{ values: [{}] }], fields: 'userEnteredValue,note' } },
      {
        setDataValidation: {
          range: { sheetId: 7, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 3, endColumnIndex: 4 },
          rule: {
            condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'Yes' }, { userEnteredValue: 'No' }, { userEnteredValue: 'Unsure' }] },
            strict: true,
            showCustomUi: true,
          },
        },
      },
      { updateDimensionProperties: { range: { sheetId: 7, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } },
    ]);
  });

  it("writes a value alone where the note is not Atlas's, leaving the note as it is", async () => {
    const { sheet, requests } = spreadsheet({ body: {} });

    await sheet.editRows(ROWS, {
      insertColumns: [],
      writes: [
        { row: 2, column: 0, value: 'A3B25-H181', note: null },
        { row: 2, column: 1, value: '180 mm', note: 'From Dimension' },
      ],
      rows: 4,
      verdicts: [],
      hideColumns: [],
    });

    expect(requests(0).map((request) => (request.updateCells as { fields: string }).fields)).toEqual(['userEnteredValue', 'userEnteredValue,note']);
  });

  it('sends nothing when a sync has nothing to change', async () => {
    const { sheet, sent } = spreadsheet();
    await sheet.editRows(ROWS, { insertColumns: [], writes: [], rows: 4, verdicts: [], hideColumns: [] });
    expect(sent).toEqual([]);
  });

  it('adds a missing tab, then draws it whole, a link leading to its line on Rows', async () => {
    const tab: LayoutTab = {
      name: 'Needs a look',
      bands: [],
      columns: [
        { name: 'Why', width: 40, band: 'result' },
        { name: 'Row', width: 6, band: 'result' },
      ],
      header: true,
      lines: [{ cells: [{ value: 'Skipped' }, { value: '7', linkTo: 'row 7 · 00000000' }] }],
      frozen: { rows: 1, columns: 0 },
      filter: true,
      wrap: true,
      verdictColumn: null,
    };
    const { sheet, sent, requests } = spreadsheet({ body: { replies: [{ addSheet: { properties: { sheetId: 42 } } }] } }, { body: {} });

    await sheet.replace(tab, null, { tab: 7, rowOf: (key) => (key === 'row 7 · 00000000' ? 4 : null) });

    expect(requests(0)).toEqual([{ addSheet: { properties: { title: 'Needs a look' } } }]);
    const drawn = requests(1);
    expect(drawn.slice(0, 2)).toEqual([{ unmergeCells: { range: { sheetId: 42 } } }, { updateCells: { range: { sheetId: 42 }, fields: '*' } }]);
    const cells = drawn.flatMap((request) => {
      const update = request.updateCells as { rows?: { values: Record<string, unknown>[] }[] } | undefined;
      return update?.rows?.flatMap((row) => row.values) ?? [];
    });
    expect(cells.map((cell) => cell.userEnteredValue)).toEqual([
      { stringValue: 'Why' },
      { stringValue: 'Row' },
      { stringValue: 'Skipped' },
      { formulaValue: '=HYPERLINK("#gid=7&range=A5","7")' },
    ]);
    expect(drawn.at(-1)).toEqual({
      setBasicFilter: { filter: { range: { sheetId: 42, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 } } },
    });
    expect(sent).toHaveLength(2);
  });

  it('asks for the sheet to be shared with the service account when Google says Atlas may not', async () => {
    const { sheet } = spreadsheet({ status: 403, body: { error: { message: 'The caller does not have permission' } } });

    const failure = await sheet.tabs().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ReviewSheetSyncError);
    expect((failure as Error).message).toBe(`Atlas may not edit the shared sheet: share it with ${ACCOUNT} as an Editor.`);
    expect(String((failure as Error).cause)).toContain('The caller does not have permission');
  });

  it('says Google is busy when it is, so the sync is tried again', async () => {
    const { sheet } = spreadsheet({ status: 503, body: 'Service Unavailable' });
    await expect(sheet.tabs()).rejects.toThrow('Google Sheets is busy or unavailable. Atlas will try again.');
  });
});
