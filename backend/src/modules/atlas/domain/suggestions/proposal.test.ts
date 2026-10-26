import { describe, expect, it } from 'vitest';
import { RULED_SLOTS, type RuledSlotKey, type SlotRule } from '../slots.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { checkProposal, type Proposal, type ProposalContext, type SuggestionTarget } from './proposal.js';
import type { InvalidSuggestionError } from './suggestion.errors.js';

const dictionary = s2Dictionary();

function context(overrides: Partial<ProposalContext> = {}): ProposalContext {
  return { dictionary, usage: 0, approvedWords: [], ...overrides };
}

function issuesOf(target: SuggestionTarget, proposal: Proposal, given: Partial<ProposalContext> = {}) {
  const result = checkProposal(target, proposal, context(given));
  return result.ok ? {} : (result.error as InvalidSuggestionError).issues;
}

const allRules = (rule: SlotRule) => Object.fromEntries(RULED_SLOTS.map((slot) => [slot, rule])) as Record<RuledSlotKey, SlotRule>;

const addMaterial = (code: string, meaning = 'Polymer, invented', searchWords: string[] = []): [SuggestionTarget, Proposal] => [
  { slot: 'material', code },
  { kind: 'add', meaning, searchWords, rules: null },
];

describe('checkProposal: add', () => {
  it('accepts a new material, tidying its code, wording and words', () => {
    const result = checkProposal(
      { slot: 'material', code: ' azz ' },
      { kind: 'add', meaning: '  Polymer, invented ', searchWords: ['Invented  Polymer', 'invented polymer', ' '], rules: null },
      context(),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        target: { slot: 'material', code: 'AZZ' },
        proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null },
      },
    });
  });

  it.each([
    ['A-Z', 'Use capital letters and digits only.'],
    ['AZ', 'The code must be 3 characters.'],
    ['AZZZ', 'The code must be 3 characters.'],
    ['000', 'can\'t be a code'],
    ['XXX', 'can\'t be a code'],
    ['APS', 'APS is already Polymer, PS (polystyrene).'],
  ])('refuses the material code %s', (code, message) => {
    expect(issuesOf(...addMaterial(code)).code?.[0]).toContain(message);
  });

  it('refuses Y as a two-letter code, and a capacity unit that is not one letter', () => {
    expect(issuesOf({ slot: 'wall', code: 'Y' }, { kind: 'add', meaning: 'Triple', searchWords: [], rules: null }).code).toEqual([
      'The code must be 2 characters.',
    ]);
    expect(issuesOf({ slot: 'capacity', code: '1' }, { kind: 'add', meaning: 'Litres', searchWords: [], rules: null }).code).toEqual([
      'A capacity unit is one capital letter.',
    ]);
    expect(issuesOf({ slot: 'capacity', code: 'Y' }, { kind: 'add', meaning: 'Litres', searchWords: [], rules: null }).code?.[0]).toContain(
      "can't be a code",
    );
  });

  it('refuses an empty or over-long wording', () => {
    expect(issuesOf(...addMaterial('AZZ', '  ')).meaning).toEqual(['Write what it means.']);
    expect(issuesOf(...addMaterial('AZZ', 'a'.repeat(121))).meaning).toEqual(['Keep it to 120 characters.']);
  });

  it('needs every field rule for a new product type, and none for anything else', () => {
    const partial = { ...allRules('applies') } as Partial<Record<RuledSlotKey, SlotRule>>;
    delete partial.window;
    delete partial.handle;
    expect(
      issuesOf({ slot: 'productType', code: 'ZZZ' }, { kind: 'add', meaning: 'Invented', searchWords: [], rules: partial as Record<RuledSlotKey, SlotRule> }).rules,
    ).toEqual(['Say whether each field applies. Missing: Handle, Window.']);
    expect(issuesOf({ slot: 'productType', code: 'ZZZ' }, { kind: 'add', meaning: 'Invented', searchWords: [], rules: allRules('never') })).toEqual({});
    expect(issuesOf({ slot: 'material', code: 'AZZ' }, { kind: 'add', meaning: 'Invented', searchWords: [], rules: allRules('never') }).rules).toEqual([
      'Only a product type has field rules.',
    ]);
  });

  it('reports every problem at once', () => {
    const issues = issuesOf({ slot: 'material', code: 'APS' }, { kind: 'add', meaning: '', searchWords: ['x'], rules: null });
    expect(Object.keys(issues).sort()).toEqual(['code', 'meaning', 'searchWords']);
  });
});

describe('checkProposal: search words', () => {
  it('refuses a word in the wrong form, and more than 20', () => {
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['a'])).searchWords).toEqual([
      '“a”: use 2–40 lower-case letters, digits, spaces or hyphens.',
    ]);
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['pp/ps'])).searchWords?.[0]).toContain('“pp/ps”');
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['a'.repeat(40)]))).toEqual({});
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['a'.repeat(41)])).searchWords?.[0]).toContain('use 2–40');
    const many = Array.from({ length: 21 }, (_, i) => `word ${i}`);
    expect(issuesOf(...addMaterial('AZZ', 'Invented', many)).searchWords).toEqual(['An option can have at most 20 search words.']);
  });

  it('refuses a word the code word list already reads as another material', () => {
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['bagasse'])).searchWords).toEqual([
      '“bagasse” already finds CBG (Molded fibre, bagasse).',
    ]);
  });

  it("refuses a product type's own name for another product type", () => {
    expect(issuesOf({ slot: 'productType', code: 'ZZZ' }, { kind: 'add', meaning: 'Invented', searchWords: ['cup'], rules: allRules('never') }).searchWords).toEqual([
      '“cup” already finds CUP (Cup).',
    ]);
  });

  it("refuses a keyword's words for another option of that list", () => {
    expect(issuesOf({ slot: 'wall', code: 'TW' }, { kind: 'add', meaning: 'Triple wall', searchWords: ['double wall'], rules: null }).searchWords).toEqual([
      '“double wall” already finds DW (Double wall).',
    ]);
  });

  it('refuses a word an approved change gave another option, but not the same option', () => {
    const approvedWords = [{ slot: 'material' as const, word: 'sugarcane fibre', code: 'CBG' }];
    expect(issuesOf(...addMaterial('AZZ', 'Invented', ['sugarcane fibre']), { approvedWords }).searchWords).toEqual([
      '“sugarcane fibre” already finds CBG (Molded fibre, bagasse).',
    ]);
    expect(
      issuesOf({ slot: 'material', code: 'CBG' }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['sugarcane fibre', 'cane fibre'] }, { approvedWords }),
    ).toEqual({});
  });

  it('lets the same word mean options in different lists', () => {
    expect(issuesOf({ slot: 'productType', code: 'ZZZ' }, { kind: 'add', meaning: 'Invented', searchWords: ['bagasse'], rules: allRules('never') })).toEqual({});
  });
});

describe('checkProposal: edit', () => {
  const edit = (overrides: Partial<Extract<Proposal, { kind: 'edit' }>>): Proposal => ({
    kind: 'edit',
    newCode: null,
    meaning: null,
    searchWords: null,
    ...overrides,
  });

  it('accepts new letters, a new wording or new words', () => {
    expect(issuesOf({ slot: 'material', code: 'APS' }, edit({ newCode: 'apz' }))).toEqual({});
    expect(issuesOf({ slot: 'material', code: 'APS' }, edit({ meaning: 'Polymer, PS' }))).toEqual({});
  });

  it('refuses an edit that changes nothing, of an option that does not exist, or to letters already used', () => {
    expect(issuesOf({ slot: 'material', code: 'APS' }, edit({})).code).toEqual(['Change the code, the wording or the search words.']);
    expect(issuesOf({ slot: 'material', code: 'AQQ' }, edit({ meaning: 'x' })).code).toEqual(['Material has no option AQQ.']);
    expect(issuesOf({ slot: 'material', code: 'APS' }, edit({ newCode: 'APP' })).newCode).toEqual(['APP is already Polymer, PP.']);
    expect(issuesOf({ slot: 'material', code: 'APS' }, edit({ newCode: 'APS' })).newCode).toEqual(['That is the code it has now.']);
  });

  it("locks RD's letters, but not its wording", () => {
    expect(issuesOf({ slot: 'shape', code: 'RD' }, edit({ newCode: 'RO' })).newCode).toEqual([
      "RD is how Atlas knows a shape is round, so its letters can't change and it can't be deleted.",
    ]);
    expect(issuesOf({ slot: 'shape', code: 'RD' }, edit({ meaning: 'Round, circular' }))).toEqual({});
  });
});

describe('checkProposal: delete', () => {
  const remove = (replacement: string | null): Proposal => ({ kind: 'delete', replacement });

  it('needs no replacement for an option nobody uses', () => {
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove(null))).toEqual({});
  });

  it('needs a replacement for an option in use: another option, or Not known', () => {
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove(null), { usage: 3 }).replacement).toEqual([
      'Pick what those Spec IDs become.',
    ]);
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove('app'), { usage: 3 })).toEqual({});
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove('Y'), { usage: 3 })).toEqual({});
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove('APS'), { usage: 3 }).replacement).toEqual([
      'Pick a different option, or Not known.',
    ]);
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove('AQQ'), { usage: 3 }).replacement).toEqual([
      'Material has no option AQQ.',
    ]);
  });

  it('never lets a product type become not known', () => {
    const message = "Pick the product type they become. Product type can't be not known.";
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, remove(null), { usage: 2 }).replacement).toEqual([message]);
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, remove('Y'), { usage: 2 }).replacement).toEqual([message]);
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, remove('BWL'), { usage: 2 })).toEqual({});
  });

  it('refuses to delete an option that does not exist', () => {
    expect(issuesOf({ slot: 'material', code: 'AQQ' }, remove(null)).code).toEqual(['Material has no option AQQ.']);
  });

  it('never deletes RD', () => {
    expect(issuesOf({ slot: 'shape', code: 'RD' }, remove('SQ'), { usage: 2 }).code?.[0]).toContain('RD is how Atlas knows');
  });
});

describe('checkProposal: rules', () => {
  it("changes a product type's rules", () => {
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { coating: 'never' } })).toEqual({});
  });

  it('refuses no change, a rule it already has, an unknown rule, or a list that is not product type', () => {
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: {} }).rules).toEqual([
      "Change at least one field's rule.",
    ]);
    expect(issuesOf({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { coating: 'applies' } }).rules).toEqual([
      'Coating is already "Applies".',
    ]);
    expect(
      issuesOf({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { coating: 'sometimes' as SlotRule } }).rules,
    ).toEqual(['Coating: sometimes is not a rule.']);
    expect(issuesOf({ slot: 'material', code: 'APS' }, { kind: 'rules', rules: { coating: 'never' } }).rules).toEqual([
      'Only a product type has field rules.',
    ]);
  });
});

describe('checkProposal: list', () => {
  it('refuses a list that is not in the dictionary', () => {
    expect(issuesOf({ slot: 'height' as never, code: 'AB' }, { kind: 'delete', replacement: null }).slot).toEqual([
      'That is not a dictionary list.',
    ]);
  });
});
