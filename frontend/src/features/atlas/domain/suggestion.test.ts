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
    // A waiting addition names no number: it is numbered when it is approved (ADR 0033).
    code: '',
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

describe("stateLine, in #95's words", () => {
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
  it('says the change is live and how many saved Spec IDs it updated', () => {
    const approved = { suggestion: suggestion(), changeNumber: 4, specIdsRewritten: 3 };
    expect(approvedLine(approved)).toBe('Change #4 is live. 3 saved Spec IDs were updated.');
    expect(approvedLine({ ...approved, specIdsRewritten: 1 })).toBe('Change #4 is live. 1 saved Spec ID was updated.');
    expect(approvedLine({ ...approved, specIdsRewritten: 0 })).toBe('Change #4 is live. 0 saved Spec IDs were updated.');
  });
});

describe('usageLine', () => {
  const deletion = { kind: 'delete', replacement: '3' } as const;
  const reword = { kind: 'edit', newCode: null, meaning: 'Polymer, PS', searchWords: null } as const;

  it('says they change too only when approving would change them, as #95 words it', () => {
    expect(usageLine(2, deletion)).toBe('Used by 2 saved Spec IDs. If approved, they change too.');
    expect(usageLine(1, deletion)).toBe('Used by 1 saved Spec ID. If approved, it changes too.');
    expect(usageLine(0, deletion)).toBeNull();
  });

  it('says a new wording changes no Spec ID: an option keeps its number (ADR 0033)', () => {
    expect(usageLine(2, reword)).toBe('Used by 2 saved Spec IDs.');
  });
});

describe('actionsFor', () => {
  it('lets the suggester edit and withdraw, and an admin who did not suggest it decide, only while it waits', () => {
    expect(actionsFor(suggestion(), { id: 'ada', isAdmin: false })).toEqual({ edit: true, withdraw: true, decide: false });
    expect(actionsFor(suggestion(), { id: 'ben', isAdmin: true })).toEqual({ edit: false, withdraw: false, decide: true });
    expect(actionsFor(suggestion(), { id: 'ada', isAdmin: true })).toEqual({ edit: true, withdraw: true, decide: false });
    expect(actionsFor(suggestion(), { id: 'cy', isAdmin: false })).toEqual({ edit: false, withdraw: false, decide: false });
    expect(actionsFor(suggestion({ state: 'approved' }), { id: 'ada', isAdmin: true })).toEqual({
      edit: false,
      withdraw: false,
      decide: false,
    });
  });
});

describe('describeSuggestion', () => {
  const dictionary: AtlasDictionary = {
    release: 'S2 0.1.0',
    approvedOn: '2026-10-19',
    change: null,
    slots: [
      { key: 'productType', name: 'Product type', values: [{ code: '5', meaning: 'Cup', number: 5, broader: null, searchWords: [] }] },
      {
        key: 'material',
        name: 'Material',
        values: [
          { code: '3', meaning: 'Polymer, PP', number: 3, broader: '11', searchWords: [] },
          { code: '4', meaning: 'Polymer, PS', number: 4, broader: '11', searchWords: [] },
          { code: '11', meaning: 'Polymer, grade not known', number: 11, broader: null, searchWords: [] },
        ],
      },
    ],
    rules: [{ productType: '5', slot: 'wall', rule: 'applies' }],
  };

  it("says a waiting new wording as it is now and as asked, naming the option as a code writes it", () => {
    const summary = describeSuggestion(
      suggestion({ kind: 'edit', code: '4', proposal: { kind: 'edit', newCode: null, meaning: 'Polymer, PS, invented', searchWords: null } }),
      dictionary,
    );
    expect(summary).toEqual({
      title: 'Change B4 in Material',
      rows: [{ label: 'Wording', before: 'Polymer, PS', after: 'Polymer, PS, invented' }],
    });
  });

  it('still shows the letters a rename made before options were known by number', () => {
    const renamed = suggestion({
      kind: 'edit',
      state: 'approved',
      code: '4',
      proposal: { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null },
    });
    expect(describeSuggestion(renamed, dictionary).rows).toEqual([{ label: 'Code', before: 'B4', after: 'APZ' }]);
  });

  it("names what a deletion's Spec IDs become, and drops today's wording once decided", () => {
    const deletion = suggestion({ kind: 'delete', code: '4', proposal: { kind: 'delete', replacement: '3' } });
    expect(describeSuggestion(deletion, dictionary)).toMatchObject({ title: 'Delete B4 from Material' });
    expect(describeSuggestion(deletion, dictionary).rows).toEqual([
      { label: 'Wording', before: 'Polymer, PS', after: 'Deleted' },
      { label: 'Saved Spec IDs become', before: null, after: 'B3 (Polymer, PP)' },
    ]);
    expect(describeSuggestion({ ...deletion, state: 'approved' }, dictionary).rows[0]?.before).toBeNull();
    expect(describeSuggestion({ ...deletion, proposal: { kind: 'delete', replacement: 'Y' } }, dictionary).rows[1]?.after).toBe(
      'Not known',
    );
  });

  it("puts each field's rule now beside the one asked for", () => {
    const rules = suggestion({ kind: 'rules', slot: 'productType', code: '5', proposal: { kind: 'rules', rules: { wall: 'never' } } });
    expect(describeSuggestion(rules, dictionary)).toEqual({
      title: 'Change which fields apply to A5',
      rows: [{ label: 'Wall', before: 'Applies', after: "Doesn't apply" }],
    });
  });

  it('says what an addition brings, and the number it took once approved', () => {
    const added = suggestion({
      proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null, broader: '11' },
    });
    expect(describeSuggestion(added, dictionary)).toEqual({
      title: 'Add an option to Material',
      rows: [
        { label: 'Wording', before: null, after: 'Polymer, invented' },
        { label: 'Search words', before: null, after: 'invented polymer' },
        { label: 'A grade of', before: null, after: 'B11 (Polymer, grade not known)' },
      ],
    });
    expect(describeSuggestion({ ...added, state: 'approved', code: '39' }, dictionary).title).toBe('Add B39 to Material');
  });
});

describe('editedFields', () => {
  it('names each field an edit changed, with what it said before and after', () => {
    expect(
      editedFields(
        { kind: 'edit', newCode: null, meaning: 'Polymer, PS', searchWords: ['styrene'] },
        { kind: 'edit', newCode: null, meaning: 'Polymer, PS', searchWords: [] },
      ),
    ).toEqual([{ label: 'Search words', before: 'styrene', after: 'None' }]);
    expect(
      editedFields(
        { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null, broader: null },
        { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null, broader: '11' },
      ),
    ).toEqual([{ label: 'A grade of material', before: 'None', after: 'B11' }]);
    expect(editedFields({ kind: 'rules', rules: { wall: 'never' } }, { kind: 'rules', rules: { wall: 'applies' } })).toEqual([
      { label: 'Field rules', before: "Wall: Doesn't apply", after: 'Wall: Applies' },
    ]);
  });
});
