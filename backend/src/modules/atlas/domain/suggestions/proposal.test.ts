import { describe, expect, it } from 'vitest';
import { Dictionary } from '../dictionary.js';
import { MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE, WALL } from '../options.js';
import { RULED_SLOTS, type DictionarySlotKey, type RuledSlotKey, type SlotRule } from '../slots.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { applyProposal } from './apply-proposal.js';
import { checkProposal, isOptionCode, type Proposal, type ProposalContext, type SuggestionTarget } from './proposal.js';
import type { InvalidSuggestionError } from './suggestion.errors.js';

const dictionary = s2Dictionary();

function context(overrides: Partial<ProposalContext> = {}): ProposalContext {
  return { dictionary, usage: 0, ...overrides };
}

function issuesOf(target: SuggestionTarget, proposal: Proposal, given: Partial<ProposalContext> = {}) {
  const result = checkProposal(target, proposal, context(given));
  return result.ok ? {} : (result.error as InvalidSuggestionError).issues;
}

const allRules = (rule: SlotRule) => Object.fromEntries(RULED_SLOTS.map((slot) => [slot, rule])) as Record<RuledSlotKey, SlotRule>;

/** A new option names no number: it is numbered when it is approved (ADR 0033). */
const newOption = (slot: DictionarySlotKey): SuggestionTarget => ({ slot, code: '' });

const addMaterial = (meaning = 'Polymer, invented', searchWords: string[] = [], broader?: string | null): [SuggestionTarget, Proposal] => [
  newOption('material'),
  { kind: 'add', meaning, searchWords, rules: null, ...(broader === undefined ? {} : { broader }) },
];

const NUMBERED = 'An option is known by its number, given when it is approved. It never changes.';

describe('checkProposal: add', () => {
  it('accepts a new material, tidying its wording and words', () => {
    const result = checkProposal(
      newOption('material'),
      { kind: 'add', meaning: '  Polymer, invented ', searchWords: ['Invented  Polymer', 'invented polymer', ' '], rules: null },
      context(),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        target: { slot: 'material', code: '' },
        proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null, broader: null },
      },
    });
  });

  it('refuses a code given for a new option: its number is given when it is approved', () => {
    expect(issuesOf({ slot: 'material', code: 'AZZ' }, addMaterial()[1]).code).toEqual([NUMBERED]);
    expect(issuesOf({ slot: 'material', code: '39' }, addMaterial()[1]).code).toEqual([NUMBERED]);
  });

  it('accepts the material a new material is a grade of, and refuses one the dictionary does not have', () => {
    const result = checkProposal(...addMaterial('Polymer, invented', [], ` ${MATERIAL.polymer} `), context());
    expect(result.ok && result.value.proposal).toMatchObject({ kind: 'add', broader: MATERIAL.polymer });
    expect(issuesOf(...addMaterial('Polymer, invented', [], '99')).broader).toEqual(['Material has no option 99.']);
  });

  it('refuses a broader option for any list but material', () => {
    expect(
      issuesOf(newOption('wall'), { kind: 'add', meaning: 'Triple wall', searchWords: [], rules: null, broader: WALL.doubleWall }).broader,
    ).toEqual(['Only a material is a grade of another.']);
  });

  it('refuses an empty or over-long wording', () => {
    expect(issuesOf(...addMaterial('  ')).meaning).toEqual(['Write what it means.']);
    expect(issuesOf(...addMaterial('a'.repeat(121))).meaning).toEqual(['Keep it to 120 characters.']);
  });

  it('needs every field rule for a new product type, and none for anything else', () => {
    const partial = { ...allRules('applies') } as Partial<Record<RuledSlotKey, SlotRule>>;
    delete partial.window;
    delete partial.handle;
    expect(
      issuesOf(newOption('productType'), { kind: 'add', meaning: 'Invented', searchWords: [], rules: partial as Record<RuledSlotKey, SlotRule> }).rules,
    ).toEqual(['Say whether each field applies. Missing: Handle, Window.']);
    expect(issuesOf(newOption('productType'), { kind: 'add', meaning: 'Invented', searchWords: [], rules: allRules('never') })).toEqual({});
    expect(issuesOf(newOption('material'), { kind: 'add', meaning: 'Invented', searchWords: [], rules: allRules('never') }).rules).toEqual([
      'Only a product type has field rules.',
    ]);
  });

  it('reports every problem at once', () => {
    const issues = issuesOf({ slot: 'material', code: MATERIAL.ps }, { kind: 'add', meaning: '', searchWords: ['x'], rules: null });
    expect(Object.keys(issues).sort()).toEqual(['code', 'meaning', 'searchWords']);
  });
});

describe('isOptionCode', () => {
  it('takes a whole number from 1, and for a capacity unit one digit', () => {
    expect(isOptionCode('material', '17')).toBe(true);
    expect(isOptionCode('material', '0')).toBe(false);
    expect(isOptionCode('material', '017')).toBe(false);
    expect(isOptionCode('material', 'BCS')).toBe(false);
    expect(isOptionCode('capacity', '1')).toBe(true);
    expect(isOptionCode('capacity', '10')).toBe(false);
    expect(isOptionCode('capacity', 'Z')).toBe(false);
  });
});

describe('checkProposal: search words', () => {
  it('refuses a word in the wrong form, and more than 20', () => {
    expect(issuesOf(...addMaterial('Invented', ['a'])).searchWords).toEqual([
      '“a”: use 2–40 lower-case letters, digits, spaces or hyphens.',
    ]);
    expect(issuesOf(...addMaterial('Invented', ['pp/ps'])).searchWords?.[0]).toContain('“pp/ps”');
    expect(issuesOf(...addMaterial('Invented', ['a'.repeat(40)]))).toEqual({});
    expect(issuesOf(...addMaterial('Invented', ['a'.repeat(41)])).searchWords?.[0]).toContain('use 2–40');
    const many = Array.from({ length: 21 }, (_, i) => `word ${i}`);
    expect(issuesOf(...addMaterial('Invented', many)).searchWords).toEqual(['An option can have at most 20 search words.']);
  });

  it('refuses a word the code word list already reads as another material, naming it as a code writes it', () => {
    expect(issuesOf(...addMaterial('Invented', ['bagasse'])).searchWords).toEqual([
      '“bagasse” already finds B25 (Molded fibre, bagasse).',
    ]);
  });

  it("refuses a product type's own name for another product type", () => {
    expect(issuesOf(newOption('productType'), { kind: 'add', meaning: 'Invented', searchWords: ['cup'], rules: allRules('never') }).searchWords).toEqual([
      '“cup” already finds A5 (Cup).',
    ]);
  });

  it("refuses a keyword's words for another option of that list", () => {
    expect(issuesOf(newOption('wall'), { kind: 'add', meaning: 'Triple wall', searchWords: ['double wall'], rules: null }).searchWords).toEqual([
      '“double wall” already finds Q2 (Double wall).',
    ]);
  });

  it('refuses a word an approved change gave another option, but not the same option', () => {
    const withWords = new Dictionary(dictionary.release, dictionary.approvedOn, dictionary.values(), dictionary.slotRules(), {
      searchWords: [{ slot: 'material', word: 'sugarcane fibre', code: MATERIAL.bagasse, changeNumber: 1 }],
    });
    expect(issuesOf(...addMaterial('Invented', ['sugarcane fibre']), { dictionary: withWords }).searchWords).toEqual([
      '“sugarcane fibre” already finds B25 (Molded fibre, bagasse).',
    ]);
    expect(
      issuesOf({ slot: 'material', code: MATERIAL.bagasse }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['sugarcane fibre', 'cane fibre'] }, { dictionary: withWords }),
    ).toEqual({});
  });

  it('lets the same word mean options in different lists', () => {
    expect(issuesOf(newOption('productType'), { kind: 'add', meaning: 'Invented', searchWords: ['bagasse'], rules: allRules('never') })).toEqual({});
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

  it('accepts a new wording or new words', () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, edit({ meaning: 'Polymer, PS' }))).toEqual({});
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, edit({ searchWords: ['styrene'] }))).toEqual({});
  });

  it('refuses a new code: an option keeps its number (ADR 0033)', () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, edit({ newCode: 'APZ' })).newCode).toEqual([NUMBERED]);
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, edit({ newCode: '40', meaning: 'Polymer, PS' })).newCode).toEqual([NUMBERED]);
  });

  it('refuses an edit that changes nothing, or of an option that does not exist', () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, edit({})).code).toEqual(['Change the wording or the search words.']);
    expect(issuesOf({ slot: 'material', code: '99' }, edit({ meaning: 'x' })).code).toEqual(['Material has no option 99.']);
  });

  it("changes round's wording", () => {
    expect(issuesOf({ slot: 'shape', code: SHAPE.round }, edit({ meaning: 'Round, circular' }))).toEqual({});
  });
});

describe('checkProposal: delete', () => {
  const remove = (replacement: string | null): Proposal => ({ kind: 'delete', replacement });

  it('needs no replacement for an option nobody uses', () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove(null))).toEqual({});
  });

  it('needs a replacement for an option in use: another option, or Not known', () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove(null), { usage: 3 }).replacement).toEqual([
      'Pick what those Spec IDs become.',
    ]);
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove(` ${MATERIAL.pp} `), { usage: 3 })).toEqual({});
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove('Y'), { usage: 3 })).toEqual({});
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove(MATERIAL.ps), { usage: 3 }).replacement).toEqual([
      'Pick a different option, or Not known.',
    ]);
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, remove('99'), { usage: 3 }).replacement).toEqual([
      'Material has no option 99.',
    ]);
  });

  it('never lets a product type become not known', () => {
    const message = "Pick the product type they become. Product type can't be not known.";
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, remove(null), { usage: 2 }).replacement).toEqual([message]);
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, remove('Y'), { usage: 2 }).replacement).toEqual([message]);
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, remove(PRODUCT_TYPE.bowl), { usage: 2 })).toEqual({});
  });

  it('refuses to delete an option that does not exist, or by its old letters', () => {
    expect(issuesOf({ slot: 'material', code: '99' }, remove(null)).code).toEqual(['Material has no option 99.']);
    expect(issuesOf({ slot: 'material', code: 'APS' }, remove(null)).code).toEqual(['Material has no option APS.']);
  });

  it('never deletes round', () => {
    expect(issuesOf({ slot: 'shape', code: SHAPE.round }, remove(SHAPE.square), { usage: 2 }).code).toEqual([
      "Round is how Atlas knows a shape is round, so it can't be deleted.",
    ]);
  });
});

describe('checkProposal: rules', () => {
  it("changes a product type's rules", () => {
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { coating: 'never' } })).toEqual({});
  });

  it('refuses no change, a rule it already has, an unknown rule, or a list that is not product type', () => {
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: {} }).rules).toEqual([
      "Change at least one field's rule.",
    ]);
    expect(issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { coating: 'applies' } }).rules).toEqual([
      'Coating is already "Applies".',
    ]);
    expect(
      issuesOf({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { coating: 'sometimes' as SlotRule } }).rules,
    ).toEqual(['Coating: sometimes is not a rule.']);
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, { kind: 'rules', rules: { coating: 'never' } }).rules).toEqual([
      'Only a product type has field rules.',
    ]);
  });
});

describe('checkProposal: list', () => {
  it('refuses a list that is not in the dictionary', () => {
    expect(issuesOf({ slot: 'height' as never, code: '1' }, { kind: 'delete', replacement: null }).slot).toEqual([
      'That is not a dictionary list.',
    ]);
  });
});

describe('checkProposal: search words after a new wording (ADR 0033)', () => {
  const reworded = applyProposal(dictionary, { slot: 'material', code: MATERIAL.bagasse }, { kind: 'edit', newCode: null, meaning: 'Molded fibre, sugarcane', searchWords: null }, {
    number: 1,
    at: new Date('2026-10-27T10:00:00.000Z'),
  });

  it("names the word list's word under the option's number and new wording", () => {
    expect(issuesOf(...addMaterial('Invented', ['bagasse']), { dictionary: reworded }).searchWords).toEqual([
      '“bagasse” already finds B25 (Molded fibre, sugarcane).',
    ]);
    expect(
      issuesOf({ slot: 'material', code: MATERIAL.bagasse }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['bagasse'] }, { dictionary: reworded }),
    ).toEqual({});
  });
});

describe('checkProposal: search words after a delete (ADR 0031)', () => {
  const stamp = (number: number) => ({ number, at: new Date('2026-10-27T10:00:00.000Z') });
  const giveWord = (word: string): Proposal => ({ kind: 'edit', newCode: null, meaning: null, searchWords: [word] });
  const deleted = applyProposal(
    applyProposal(dictionary, { slot: 'material', code: MATERIAL.bagasse }, { kind: 'delete', replacement: null }, stamp(1)),
    { slot: 'profile', code: PROFILE.halfDome },
    { kind: 'delete', replacement: null },
    stamp(2),
  );
  const given = applyProposal(
    applyProposal(deleted, { slot: 'material', code: MATERIAL.pp }, giveWord('bagasse'), stamp(3)),
    { slot: 'profile', code: PROFILE.dome },
    giveWord('half dome'),
    stamp(4),
  );

  it("frees a deleted option's word, and refuses it once another option has it", () => {
    expect(issuesOf({ slot: 'material', code: MATERIAL.pp }, giveWord('bagasse'), { dictionary: deleted })).toEqual({});
    expect(issuesOf({ slot: 'material', code: MATERIAL.ps }, giveWord('bagasse'), { dictionary: given }).searchWords).toEqual([
      '“bagasse” already finds B3 (Polymer, PP).',
    ]);
    expect(issuesOf({ slot: 'profile', code: PROFILE.flat }, giveWord('half dome'), { dictionary: given }).searchWords?.[0]).toMatch(
      /^“half dome” already finds F1 /,
    );
  });
});
