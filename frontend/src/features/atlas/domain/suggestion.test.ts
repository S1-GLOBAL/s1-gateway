import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from './atlas';
import {
  actionsFor,
  approvedLine,
  describeSuggestion,
  editedFields,
  stateLine,
  usageLine,
  type Suggestion,
} from './suggestion';

const ADA = { id: 'ada', fullName: 'Ada Invented' };
const BEN = { id: 'ben', fullName: 'Ben Invented' };

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 's1',
    kind: 'add',
    slot: 'material',
    code: 'AZZ',
    proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null },
    state: 'waiting',
    version: 1,
    suggestedBy: ADA,
    suggestedAt: new Date('2026-10-27T08:00:00.000Z'),
    decidedBy: null,
    decidedAt: null,
    reason: null,
    changeNumber: null,
    ...overrides,
  };
}

describe('stateLine, in #95 words', () => {
  it('reads each state', () => {
    expect(stateLine(suggestion())).toBe('Waiting for an admin');
    expect(stateLine(suggestion({ state: 'approved', decidedBy: BEN, changeNumber: 4 }))).toBe('Approved as change #4 by Ben Invented');
    expect(stateLine(suggestion({ state: 'rejected', decidedBy: BEN, reason: 'We have APP.' }))).toBe(
      'Rejected by Ben Invented: We have APP.',
    );
    expect(stateLine(suggestion({ state: 'withdrawn' }))).toBe('Withdrawn');
  });
});

describe('approvedLine', () => {
  it("says the change is live and how many saved Spec IDs it updated", () => {
    const approved = { suggestion: suggestion(), changeNumber: 4, specIdsRewritten: 3 };
    expect(approvedLine(approved)).toBe('Change #4 is live. 3 saved Spec IDs were updated.');
    expect(approvedLine({ ...approved, specIdsRewritten: 1 })).toBe('Change #4 is live. 1 saved Spec ID was updated.');
    expect(approvedLine({ ...approved, specIdsRewritten: 0 })).toBe('Change #4 is live. 0 saved Spec IDs were updated.');
  });
});

describe('usageLine', () => {
  const rename = { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null } as const;
  const reword = { kind: 'edit', newCode: null, meaning: 'Polymer, PS', searchWords: null } as const;

  it("says they change too only when approving would change them, as #95 words it", () => {
    expect(usageLine(2, rename)).toBe('Used by 2 saved Spec IDs. If approved, they change too.');
    expect(usageLine(1, rename)).toBe('Used by 1 saved Spec ID. If approved, it changes too.');
    expect(usageLine(2, reword)).toBe('Used by 2 saved Spec IDs.');
    expect(usageLine(0, rename)).toBeNull();
  });
});

describe('actionsFor', () => {
  it('lets the suggester withdraw, and an admin who did not suggest it decide, only while it waits', () => {
    expect(actionsFor(suggestion(), { id: 'ada', isAdmin: false })).toEqual({ withdraw: true, decide: false });
    expect(actionsFor(suggestion(), { id: 'ben', isAdmin: true })).toEqual({ withdraw: false, decide: true });
    expect(actionsFor(suggestion(), { id: 'ada', isAdmin: true })).toEqual({ withdraw: true, decide: false });
    expect(actionsFor(suggestion(), { id: 'cy', isAdmin: false })).toEqual({ withdraw: false, decide: false });
    expect(actionsFor(suggestion({ state: 'approved' }), { id: 'ben', isAdmin: true })).toEqual({ withdraw: false, decide: false });
  });
});

describe('describeSuggestion', () => {
  const dictionary: AtlasDictionary = {
    release: 'S2 0.1.0',
    approvedOn: '2026-10-19',
    slots: [
      { key: 'productType', name: 'Product type', values: [{ code: 'CUP', meaning: 'Cup' }] },
      { key: 'material', name: 'Material', values: [{ code: 'APS', meaning: 'Polymer, PS' }, { code: 'APP', meaning: 'Polymer, PP' }] },
    ],
    rules: [{ productType: 'CUP', slot: 'wall', rule: 'applies' }],
  };

  it("says a waiting rename's code and wording as they are now and as asked", () => {
    const summary = describeSuggestion(
      suggestion({ kind: 'edit', code: 'APS', proposal: { kind: 'edit', newCode: 'APZ', meaning: 'Polymer, PS, invented', searchWords: null } }),
      dictionary,
    );
    expect(summary).toEqual({
      title: 'Change APS in Material',
      rows: [
        { label: 'Code', before: 'APS', after: 'APZ' },
        { label: 'Wording', before: 'Polymer, PS', after: 'Polymer, PS, invented' },
      ],
    });
  });

  it("names what a deletion's Spec IDs become, and drops today's wording once decided", () => {
    const deletion = suggestion({ kind: 'delete', code: 'APS', proposal: { kind: 'delete', replacement: 'APP' } });
    expect(describeSuggestion(deletion, dictionary).rows).toEqual([
      { label: 'Wording', before: 'Polymer, PS', after: 'Deleted' },
      { label: 'Saved Spec IDs become', before: null, after: 'APP (Polymer, PP)' },
    ]);
    expect(describeSuggestion({ ...deletion, state: 'approved' }, dictionary).rows[0]?.before).toBeNull();
    expect(describeSuggestion({ ...deletion, proposal: { kind: 'delete', replacement: 'Y' } }, dictionary).rows[1]?.after).toBe(
      'Not known (Y)',
    );
  });

  it("puts each field's rule now beside the one asked for", () => {
    const rules = suggestion({ kind: 'rules', slot: 'productType', code: 'CUP', proposal: { kind: 'rules', rules: { wall: 'never' } } });
    expect(describeSuggestion(rules, dictionary)).toEqual({
      title: 'Change which fields apply to CUP',
      rows: [{ label: 'Wall', before: 'Applies', after: 'X' }],
    });
  });

  it('says what an addition brings', () => {
    const added = suggestion({ proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null } });
    expect(describeSuggestion(added, dictionary)).toEqual({
      title: 'Add AZZ to Material',
      rows: [
        { label: 'Wording', before: null, after: 'Polymer, invented' },
        { label: 'Search words', before: null, after: 'invented polymer' },
      ],
    });
  });
});

describe('editedFields', () => {
  it('names each field an edit changed, with what it said before and after', () => {
    expect(
      editedFields(
        { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: ['styrene'] },
        { kind: 'edit', newCode: 'APY', meaning: null, searchWords: [] },
      ),
    ).toEqual([
      { label: 'Code', before: 'APZ', after: 'APY' },
      { label: 'Search words', before: 'styrene', after: 'None' },
    ]);
    expect(editedFields({ kind: 'rules', rules: { wall: 'never' } }, { kind: 'rules', rules: { wall: 'applies' } })).toEqual([
      { label: 'Field rules', before: 'Wall: X', after: 'Wall: Applies' },
    ]);
  });
});
