import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from './atlas';
import {
  broaderOptions,
  draftProposal,
  isRoundShape,
  readSearchWords,
  replacementOptions,
  startDraft,
  SUGGESTION_COPY,
  suggestionIntro,
  suggestionTitle,
  targetCode,
  type DraftContext,
  type SuggestionTarget,
} from './suggestion-form';

/* Invented options only (constraints §6). Each option's key is its number (ADR 0033). */
const dictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: '1', meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] }, { code: '3', meaning: 'Bowl', number: 3, broader: null, searchWords: [] }] },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: '3', meaning: 'Polymer, PP', number: 3, broader: '11', searchWords: [] },
        { code: '4', meaning: 'Polymer, PS', number: 4, broader: '11', searchWords: [] },
        { code: '11', meaning: 'Polymer, grade not known', number: 11, broader: null, searchWords: [] },
      ],
    },
    { key: 'shape', name: 'Shape', values: [{ code: '1', meaning: 'Round', number: 1, broader: null, searchWords: [] }, { code: '2', meaning: 'Square', number: 2, broader: null, searchWords: [] }] },
  ],
  rules: [
    { productType: '1', slot: 'coating', rule: 'applies' },
    { productType: '1', slot: 'wall', rule: 'never' },
    { productType: '3', slot: 'coating', rule: 'never' },
    { productType: '3', slot: 'wall', rule: 'applies' },
  ],
  change: null,
};

const context: DraftContext = { dictionary, currentWords: ['styrene foam'], usage: 2 };

describe('the suggestion form, by kind', () => {
  it('adds an option with its search words, one per line, about no number: it is numbered when approved', () => {
    const target: SuggestionTarget = { kind: 'add', slot: 'coating' };
    const draft = { ...startDraft(target, context, null), meaning: 'Invented coating', words: 'invented coat\n\n  cane   wax ' };
    expect(draftProposal(target, draft, context)).toEqual({
      kind: 'add',
      meaning: 'Invented coating',
      searchWords: ['invented coat', 'cane wax'],
      rules: null,
    });
    expect(targetCode(target)).toBe('');
  });

  it('adds a material as a grade of another, or of none', () => {
    const target: SuggestionTarget = { kind: 'add', slot: 'material' };
    const draft = { ...startDraft(target, context, null), meaning: 'Polymer, invented' };
    expect(draftProposal(target, { ...draft, broader: '11' }, context)).toMatchObject({ kind: 'add', broader: '11' });
    expect(draftProposal(target, draft, context)).toMatchObject({ kind: 'add', broader: null });
  });

  it("adds a product type with every rule, copied from the first product type and editable", () => {
    const target: SuggestionTarget = { kind: 'add', slot: 'productType' };
    const draft = startDraft(target, context, null);
    expect(draft.rules).toEqual({ coating: 'applies', wall: 'never' });
    const proposal = draftProposal(target, { ...draft, meaning: 'Tray', rules: { ...draft.rules, wall: 'applies' } }, context);
    expect(proposal).toMatchObject({ kind: 'add', rules: { coating: 'applies', wall: 'applies' } });
  });

  it("edits only the wording and search words that differ from today, and never the number", () => {
    const target: SuggestionTarget = { kind: 'edit', slot: 'material', code: '4' };
    const draft = startDraft(target, context, null);
    expect(draft).toMatchObject({ meaning: 'Polymer, PS', words: 'styrene foam' });
    expect(draftProposal(target, { ...draft, meaning: 'Polymer, PS (polystyrene)' }, context)).toEqual({
      kind: 'edit',
      newCode: null,
      meaning: 'Polymer, PS (polystyrene)',
      searchWords: null,
    });
    expect(draftProposal(target, { ...draft, words: 'styrene foam\nfoam cup' }, context)).toEqual({
      kind: 'edit',
      newCode: null,
      meaning: null,
      searchWords: ['styrene foam', 'foam cup'],
    });
    expect(targetCode(target)).toBe('4');
  });

  it('deletes an option in use, naming what its Spec IDs become; one in no use names nothing', () => {
    const target: SuggestionTarget = { kind: 'delete', slot: 'material', code: '4' };
    const draft = { ...startDraft(target, context, null), replacement: 'Y' };
    expect(draftProposal(target, draft, context)).toEqual({ kind: 'delete', replacement: 'Y' });
    expect(draftProposal(target, draft, { ...context, usage: 0 })).toEqual({ kind: 'delete', replacement: null });
  });

  it('offers the other options, as a code writes them, and Not known (Y) for a delete; a product type has no Not known', () => {
    expect(replacementOptions(dictionary, 'material', '4')).toEqual([
      { value: '3', label: 'B3 — Polymer, PP' },
      { value: '11', label: 'B11 — Polymer, grade not known' },
      { value: 'Y', label: 'Not known (Y)' },
    ]);
    expect(replacementOptions(dictionary, 'productType', '1')).toEqual([{ value: '3', label: 'A3 — Bowl' }]);
  });

  it('offers None, then every material, for what a new material is a grade of', () => {
    expect(broaderOptions(dictionary)).toEqual([
      { value: '', label: 'None' },
      { value: '3', label: 'B3 — Polymer, PP' },
      { value: '4', label: 'B4 — Polymer, PS' },
      { value: '11', label: 'B11 — Polymer, grade not known' },
    ]);
  });

  it("changes a product type's rules, sending only those that differ", () => {
    const target: SuggestionTarget = { kind: 'rules', slot: 'productType', code: '1' };
    const draft = startDraft(target, context, null);
    expect(draftProposal(target, { ...draft, rules: { ...draft.rules, wall: 'applies' } }, context)).toEqual({
      kind: 'rules',
      rules: { wall: 'applies' },
    });
  });

  it('starts from what a waiting suggestion asks for when it is edited', () => {
    const target: SuggestionTarget = { kind: 'edit', slot: 'material', code: '4' };
    const draft = startDraft(target, context, { kind: 'edit', newCode: null, meaning: null, searchWords: ['foam'] });
    expect(draft).toMatchObject({ meaning: 'Polymer, PS', words: 'foam' });
    const material = startDraft({ kind: 'add', slot: 'material' }, context, {
      kind: 'add',
      meaning: 'Polymer, invented',
      searchWords: [],
      rules: null,
      broader: '11',
    });
    expect(material).toMatchObject({ meaning: 'Polymer, invented', broader: '11' });
  });
});

describe('the words the form shows', () => {
  it('names the option as a code writes it', () => {
    expect(suggestionTitle({ kind: 'edit', slot: 'material', code: '4' }, dictionary)).toBe('Suggest an edit to B4');
    expect(suggestionTitle({ kind: 'add', slot: 'material' }, dictionary)).toBe('Suggest an option for Material');
    expect(suggestionIntro({ kind: 'delete', slot: 'material', code: '4' }, dictionary)).toBe(
      'Material, B4 (Polymer, PS). Nothing changes until an admin approves it.',
    );
  });

  it('keeps Round, shape 1, from being deleted, and only Round', () => {
    expect(isRoundShape('shape', '1')).toBe(true);
    expect(isRoundShape('shape', '2')).toBe(false);
    expect(isRoundShape('material', '1')).toBe(false);
    expect(SUGGESTION_COPY.roundLocked).toBe("Round is how Atlas knows a shape is round, so it can't be deleted.");
  });

  it('says a new option is numbered when it is approved', () => {
    expect(SUGGESTION_COPY.numbered).toBe('It is numbered when an admin approves it: the next number in this list.');
  });

  it('reads one search word per line', () => {
    expect(readSearchWords(' a b \n\nc')).toEqual(['a b', 'c']);
  });
});
