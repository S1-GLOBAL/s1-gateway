import { describe, expect, it } from 'vitest';
import { describeSync } from './atlas-sheet-sync.js';

const SUMMARY = {
  dryRun: true,
  madeRows: false,
  columnsAdded: ['Atlas key'],
  adopted: 1442,
  updated: 2,
  added: 1,
  removed: 0,
  rewritten: ['How to read this', 'Spec IDs', 'Needs a look', 'Dictionary'],
  changes: [{ row: 12, column: 'Code', from: 'A3B25-H180', to: 'A3B25-H181' }],
};

describe('describeSync (plan 0016)', () => {
  it('says what a dry run would change, cell by cell, and that it wrote nothing', () => {
    expect(describeSync(SUMMARY)).toBe(
      [
        'Dry run: nothing was written to the sheet.',
        "Rows tab: 1442 lines already on it taken as Atlas's, by their key written beside them;",
        '  2 lines with a cell changed; 1 lines added below the last;',
        '  0 lines marked "No longer in Atlas"; columns added: Atlas key.',
        "  Nothing under Correct?, What's wrong, Reviewer or Date, or in a column Atlas does not know, is written.",
        'Written whole: How to read this, Spec IDs, Needs a look, Dictionary.',
        '',
        'Cells on the Rows tab a sync would change:',
        '  row 12, Code: "A3B25-H180" → "A3B25-H181"',
      ].join('\n'),
    );
  });

  it('says a missing Rows tab is made whole, and counts the changes past the first two hundred', () => {
    const many = Array.from({ length: 205 }, (_, index) => ({ row: index + 3, column: 'Code', from: '', to: `A${index}` }));
    const said = describeSync({ ...SUMMARY, dryRun: false, madeRows: true, added: 3, changes: many });
    expect(said.split('\n').slice(0, 2)).toEqual(['Synced the shared review sheet.', 'The Rows tab is missing: a sync did make it whole, 3 lines.']);
    expect(said.endsWith('  …and 5 more.')).toBe(true);
  });
});
