import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from './atlas';
import {
  codeHint,
  draftProposal,
  isRoundShape,
  readSearchWords,
  replacementOptions,
  startDraft,
  SUGGESTION_COPY,
  type DraftContext,
  type SuggestionTarget,
} from './suggestion-form';

/* Invented options only (constraints §6). */
const dictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid', number: 1, searchWords: [] }, { code: 'BWL', meaning: 'Bowl', number: 2, searchWords: [] }] },
    { key: 'material', name: 'Material', values: [{ code: 'APS', meaning: 'Polymer, PS', number: 1, searchWords: [] }, { code: 'APP', meaning: 'Polymer, PP', number: 2, searchWords: [] }] },
    { key: 'shape', name: 'Shape', values: [{ code: 'RD', meaning: 'Round', number: 1, searchWords: [] }, { code: 'SQ', meaning: 'Square', number: 2, searchWords: [] }] },
  ],
  rules: [
    { productType: 'BLD', slot: 'coating', rule: 'applies' },
    { productType: 'BLD', slot: 'wall', rule: 'never' },
    { productType: 'BWL', slot: 'coating', rule: 'never' },
    { productType: 'BWL', slot: 'wall', rule: 'applies' },
  ],
  change: null,
};

const context: DraftContext = { dictionary, currentWords: ['styrene foam'], usage: 2 };

describe('the suggestion form, by kind', () => {
  it('adds an option with its search words, one per line', () => {
    const target: SuggestionTarget = { kind: 'add', slot: 'material' };
    const draft = { ...startDraft(target, context, null), code: 'azz', meaning: 'Polymer, invented', words: 'invented polymer\n\n  cane   pulp ' };
    expect(draftProposal(target, draft, context)).toEqual({
      kind: 'add',
      meaning: 'Polymer, invented',
      searchWords: ['invented polymer', 'cane pulp'],
      rules: null,
    });
  });

  it("adds a product type with every rule, copied from the first product type and editable", () => {
    const target: SuggestionTarget = { kind: 'add', slot: 'productType' };
    const draft = startDraft(target, context, null);
    expect(draft.rules).toEqual({ coating: 'applies', wall: 'never' });
    const proposal = draftProposal(target, { ...draft, meaning: 'Tray', rules: { ...draft.rules, wall: 'applies' } }, context);
    expect(proposal).toMatchObject({ kind: 'add', rules: { coating: 'applies', wall: 'applies' } });
  });

  it("edits only what differs from the option today, starting from today's wording and search words", () => {
    const target: SuggestionTarget = { kind: 'edit', slot: 'material', code: 'APS' };
    const draft = startDraft(target, context, null);
    expect(draft).toMatchObject({ code: 'APS', meaning: 'Polymer, PS', words: 'styrene foam' });
    expect(draftProposal(target, { ...draft, code: 'apz' }, context)).toEqual({ kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null });
    expect(draftProposal(target, { ...draft, words: 'styrene foam\nfoam cup' }, context)).toEqual({
      kind: 'edit',
      newCode: null,
      meaning: null,
      searchWords: ['styrene foam', 'foam cup'],
    });
  });

  it('deletes an option in use, naming what its Spec IDs become; one in no use names nothing', () => {
    const target: SuggestionTarget = { kind: 'delete', slot: 'material', code: 'APS' };
    const draft = { ...startDraft(target, context, null), replacement: 'Y' };
    expect(draftProposal(target, draft, context)).toEqual({ kind: 'delete', replacement: 'Y' });
    expect(draftProposal(target, draft, { ...context, usage: 0 })).toEqual({ kind: 'delete', replacement: null });
  });

  it('offers the other options and Not known (Y) for a delete; a product type has no Not known', () => {
    expect(replacementOptions(dictionary, 'material', 'APS')).toEqual([
      { value: 'APP', label: 'APP — Polymer, PP' },
      { value: 'Y', label: 'Not known (Y)' },
    ]);
    expect(replacementOptions(dictionary, 'productType', 'BLD')).toEqual([{ value: 'BWL', label: 'BWL — Bowl' }]);
  });

  it("changes a product type's rules, sending only those that differ", () => {
    const target: SuggestionTarget = { kind: 'rules', slot: 'productType', code: 'BLD' };
    const draft = startDraft(target, context, null);
    expect(draftProposal(target, { ...draft, rules: { ...draft.rules, wall: 'applies' } }, context)).toEqual({
      kind: 'rules',
      rules: { wall: 'applies' },
    });
  });

  it('starts from what a waiting suggestion asks for when it is edited', () => {
    const target: SuggestionTarget = { kind: 'edit', slot: 'material', code: 'APS' };
    const draft = startDraft(target, context, { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: ['foam'] });
    expect(draft).toMatchObject({ code: 'APZ', meaning: 'Polymer, PS', words: 'foam' });
  });
});

describe('the words the form shows', () => {
  it("locks RD's letters, and only RD's", () => {
    expect(isRoundShape('shape', 'RD')).toBe(true);
    expect(isRoundShape('shape', 'SQ')).toBe(false);
    expect(SUGGESTION_COPY.roundLocked).toBe("RD is how Atlas knows a shape is round, so its letters can't change and it can't be deleted.");
  });

  it("hints a material's family, as #95 words it", () => {
    expect(codeHint('material')).toBe('The first letter is its family: B is paper and paperboard.');
    expect(codeHint('coating')).toBe('2 capital letters or digits.');
  });

  it('reads one search word per line', () => {
    expect(readSearchWords(' a b \n\nc')).toEqual(['a b', 'c']);
  });
});
