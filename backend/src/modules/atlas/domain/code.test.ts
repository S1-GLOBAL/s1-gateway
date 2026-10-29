import { describe, expect, it } from 'vitest';
import { CODE_LETTERS, codeInToday, isDottedCode, writtenSlots } from './code.js';
import { Dictionary } from './dictionary.js';
import { slotDefinition } from './slots.js';
import { InvalidSpecIdError } from './spec-id.errors.js';
import { SpecId, type SpecIdFactsInput } from './spec-id.js';
import { applyProposal } from './suggestions/apply-proposal.js';
import { s2Dictionary } from './testing/s2-dictionary.js';
import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1 } from './testing/spec-id-codes.js';
import { watchCode } from './watch-code.js';

const dictionary = s2Dictionary();
const AT = { number: 1, at: new Date('2026-10-29T00:00:00Z') };

/** The cup from ADR 0025, as it was written before ADR 0032. Its values are invented. */
const CUP_DOTTED = 'CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X';
const CUP = 'A5B17D3E1Q2R3-G112H90J110';
const CUP_SUMMARY = 'Cup, Paper and paperboard, cup stock, White, Round, 12 oz, 90 mm, 110 mm, Double wall, 2 colours';

function read(code: string, using: Dictionary = dictionary): SpecId {
  const result = SpecId.parse(code, using);
  if (!result.ok) throw new Error(`expected ${code} to read: ${JSON.stringify(result.error.issues)}`);
  return result.value;
}

function build(facts: SpecIdFactsInput): SpecId {
  const result = SpecId.build(facts, dictionary);
  if (!result.ok) throw new Error(JSON.stringify(result.error.issues));
  return result.value;
}

function problemsOf(code: string): readonly string[] {
  const result = SpecId.parse(code, dictionary);
  if (result.ok) throw new Error(`expected ${code} to be refused`);
  expect(result.error).toBeInstanceOf(InvalidSpecIdError);
  return result.error.issues.code ?? [];
}

function summary(specId: SpecId): string {
  return specId
    .describe(dictionary)
    .filter((slot) => slot.state === 'value')
    .map((slot) => slot.meaning)
    .join(', ');
}

/** The parts of a code, last first, so a test can type a code out of order. */
function reversed(code: string): string {
  return (code.replace('-', '').match(/[A-Z][\d.]*/g) ?? []).reverse().join('');
}

describe('the code (ADR 0032)', () => {
  it('writes only the known facts, in slot order, sizes after one hyphen', () => {
    const cup = read(CUP_DOTTED);
    expect(cup.code).toBe(CUP);
    expect(summary(cup)).toBe(CUP_SUMMARY);
    expect(CUP_DOTTED.length).toBe(67);
  });

  it('reads any order, any case, and stores one spelling', () => {
    const shuffled = read(reversed(CUP).toLowerCase());
    expect(shuffled.code).toBe(CUP);
    expect(summary(shuffled)).toBe(CUP_SUMMARY);
    expect(read(CUP).code).toBe(CUP);
  });

  it('reads every code given out before as the same Spec ID', () => {
    expect(read(ILLUSTRATIVE).code).toBe('A1B4D1E1F1-H90N33');
    expect(read(ILLUSTRATIVE_LONG).code).toBe('A1B4D1E1F1-H90N33');
    expect(read(ILLUSTRATIVE_S1).code).toBe('A1B4D1E1F1-H90N33');
    expect(summary(read(ILLUSTRATIVE))).toBe('Bowl lid, Polymer, PS (polystyrene), Clear, Round, Dome, 90 mm, 3.3 g');
  });

  it('keeps each slot’s stored value, and how the code writes it', () => {
    const slots = new Map(read(CUP).describe(dictionary).map((slot) => [slot.key, slot]));
    expect(slots.get('material')).toMatchObject({ raw: 'BCS', part: 'B17' });
    expect(slots.get('capacity')).toMatchObject({ raw: 'Z0012', part: 'G112', meaning: '12 oz' });
    expect(slots.get('coating')).toMatchObject({ raw: 'Y', part: '', state: 'not-known' });
    expect(slots.get('profile')).toMatchObject({ raw: 'X', part: '', state: 'does-not-apply' });
    expect(slots.get('variant')?.part).toBe('');
  });

  it('leaves out a fact that was not given', () => {
    const cup = build({ productType: 'CUP', material: 'BCS', capacity: { unit: 'Z', value: '12' } });
    expect(cup.code).toBe('A5B17-G112');
    expect(read(cup.code).code).toBe(cup.code);
  });

  it('writes the capacity unit as the digit after G', () => {
    expect(build({ productType: 'CUP', capacity: { unit: 'M', value: '500' } }).code).toBe('A5-G2500');
    expect(build({ productType: 'CUP', capacity: { unit: 'G', value: '12' } }).code).toBe('A5-G512');
    expect(summary(read('A5-G2500'))).toBe('Cup, 500 mL');
    expect(problemsOf('A5-G9500')).toEqual(['Nominal capacity: write a unit digit then the amount, for example G112 for 12 oz.']);
  });

  it('stores a decimal capacity with its point', () => {
    const cup = build({ productType: 'PCP', capacity: { unit: 'Z', value: '3.25' } });
    expect(cup.code).toBe('A6-G13.25');
    expect(cup.slot('capacity')).toBe('Z0003.25');
    expect(summary(cup)).toBe('Portion cup, 3.25 oz');
    expect(read('A6-G13.25').code).toBe('A6-G13.25');
    expect(summary(read('A6-G1325'))).toBe('Portion cup, 325 oz');
    expect(build({ productType: 'PCP', capacity: { unit: 'Z', value: '6.0' } }).code).toBe('A6-G16');
    expect(build({ productType: 'PCP', capacity: { unit: 'Z', value: '03.250' } }).code).toBe('A6-G13.25');
    expect(build({ productType: 'PCP', capacity: { unit: 'Z', value: '0.5' } }).code).toBe('A6-G10.5');
    expect(isDottedCode('A6-G13.25')).toBe(false);
  });

  it('refuses a capacity of 0, over 9999, or with more than 6 decimal places', () => {
    for (const value of ['0', '10000', '1.1234567']) {
      expect(SpecId.build({ productType: 'PCP', capacity: { unit: 'Z', value } }, dictionary).ok, value).toBe(false);
    }
  });

  it('refuses a letter with no number, and names it', () => {
    expect(problemsOf('B4AD1')).toEqual(['Product type (A) has no value. Write a number after A, for example A1.']);
  });

  it('refuses a code with no product type', () => {
    expect(problemsOf('B17D3')).toEqual(['Product type (A) is missing. Every code includes it, for example A1.']);
  });

  it('refuses a slot the product does not have', () => {
    expect(problemsOf('A16B6H90')).toEqual(["Top diameter doesn't apply to a bag. Leave it out."]);
    expect(problemsOf('A5F1')).toEqual(["Profile doesn't apply to a cup. Leave it out."]);
  });

  it('refuses a diameter while the shape is left out', () => {
    expect(problemsOf('A5H90')).toEqual([
      "Top diameter can't be set while the shape is not known. Add the shape, or leave top diameter out.",
    ]);
  });

  it('refuses a number the dictionary does not have, and the same slot twice', () => {
    expect(problemsOf('A5B99D3')).toEqual(['Material: 99 is not in the dictionary.']);
    expect(problemsOf('A5A6')).toEqual(['Product type is given twice.']);
  });

  it('refuses a number before its letter, a letter that is not the code’s, and a second hyphen', () => {
    expect(problemsOf('5A')).toEqual(['A code is letters and numbers, like A5B17. This one has a number before its letter.']);
    expect(problemsOf('A5Z3')).toEqual(['Z is not a letter of the code.']);
    expect(problemsOf('A5 B17')).toEqual(['A Spec ID uses letters, numbers and one hyphen.']);
    expect(problemsOf('A5-B17-G112')).toEqual(['A Spec ID has one hyphen, before the sizes.']);
  });

  it('refuses a value out of its range with the build’s message, about the whole code', () => {
    const problems = problemsOf('A21S13');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Compartments');
  });

  it('reads a product type on its own', () => {
    expect(read('A5').code).toBe('A5');
    expect(summary(read('A5'))).toBe('Cup');
  });

  it('has one letter per slot, A to X, in slot order', () => {
    expect(CODE_LETTERS.map((entry) => entry.letter).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWX');
    expect(CODE_LETTERS.map((entry) => slotDefinition(entry.slot).number)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1),
    );
  });
});

describe('the dictionary’s numbers (ADR 0032)', () => {
  it('numbers every list in the order it was issued', () => {
    expect(dictionary.numberOf('productType', 'BLD')).toBe(1);
    expect(dictionary.numberOf('productType', 'CUP')).toBe(5);
    expect(dictionary.numberOf('productType', 'LBL')).toBe(31);
    expect(['BWB', 'CWC', 'PWC'].map((code) => dictionary.numberOf('productType', code))).toEqual([32, 33, 34]);
    expect(dictionary.numberOf('material', 'BCS')).toBe(17);
    expect(dictionary.numberOf('colourClarity', 'WH')).toBe(3);
    expect(['Z', 'M', 'S', 'N', 'G'].map((unit) => dictionary.numberOf('capacity', unit))).toEqual([1, 2, 3, 4, 5]);
    expect(dictionary.valueNumbered('material', 17)?.code).toBe('BCS');
  });

  it('keeps a renamed option’s number, so its codes do not change', () => {
    const renamed = applyProposal(
      dictionary,
      { slot: 'material', code: 'BCS' },
      { kind: 'edit', newCode: 'BCX', meaning: null, searchWords: null },
      AT,
    );
    expect(renamed.numberOf('material', 'BCX')).toBe(17);
    expect(read(CUP, renamed).slot('material')).toBe('BCX');
    expect(codeInToday(CUP_DOTTED, renamed)).toBe(CUP);
  });

  it('gives a new option the next number, and never a deleted one’s again', () => {
    const deleted = applyProposal(dictionary, { slot: 'window', code: 'WN' }, { kind: 'delete', replacement: null }, AT);
    expect(deleted.retiredNumbered('window', 2)).toMatchObject({ code: 'WN', meaning: 'With window', changeNumber: 1 });
    const added = applyProposal(
      deleted,
      { slot: 'window', code: 'WF' },
      { kind: 'add', meaning: 'Full window', searchWords: [], rules: null },
      { ...AT, number: 2 },
    );
    expect(added.numberOf('window', 'WF')).toBe(3);
  });

  it('numbers values given without numbers after those given with them', () => {
    const numbered = new Dictionary(
      'S2 0.1.0',
      '2026-10-19',
      [
        { slot: 'wall', code: 'SW', meaning: 'Single wall', number: 4 },
        { slot: 'wall', code: 'DW', meaning: 'Double wall' },
      ],
      [],
    );
    expect(numbered.numberOf('wall', 'DW')).toBe(5);
  });
});

describe('a code written before (ADR 0032)', () => {
  it('reads in today’s spelling, through a rename, and a deleted option by its letters', () => {
    expect(codeInToday(CUP_DOTTED, dictionary)).toBe(CUP);
    expect(codeInToday(ILLUSTRATIVE_LONG, dictionary)).toBe('A1B4D1E1F1-H90N33');
    expect(codeInToday('d3e1q2r3a5b17-j110h90g112', dictionary)).toBe(CUP);
    expect(codeInToday('not a code', dictionary)).toBeNull();

    const deleted = applyProposal(dictionary, { slot: 'wall', code: 'DW' }, { kind: 'delete', replacement: null }, AT);
    expect(writtenSlots(CUP, deleted)?.wall).toBe('DW');
    expect(codeInToday(CUP_DOTTED, deleted)).toBe(CUP);
  });

  it('is read for History without today’s rules, a slot left out as its product has it', () => {
    const lid = SpecId.restoreWritten('A1B4D1E1F1-H90N33', dictionary);
    expect(lid?.slot('capacity')).toBe('X');
    expect(lid?.slot('coating')).toBe('Y');
    expect(lid?.code).toBe('A1B4D1E1F1-H90N33');
    expect(SpecId.restoreWritten('', dictionary)).toBeNull();
  });
});

describe('a code as it is typed (ADR 0032)', () => {
  it('warns about each part, and leaves the text alone', () => {
    expect(watchCode('A1', dictionary)).toEqual({ warnings: [], facts: [{ name: 'Product type', meaning: 'Bowl lid' }] });

    const capacity = watchCode('A1G', dictionary);
    expect(capacity.warnings).toEqual(['Nominal capacity: This part is not applicable for a bowl lid.']);
    expect(capacity.facts).toEqual([{ name: 'Product type', meaning: 'Bowl lid' }]);

    expect(watchCode('A1GY', dictionary).warnings).toEqual([
      'Nominal capacity: This part is not applicable for a bowl lid.',
      'Y: This key/part is unknown.',
    ]);
    expect(watchCode('A99', dictionary).warnings).toEqual(['A99: This key/part is unknown.']);
    expect(watchCode('A5E2H', dictionary).warnings).toEqual(['Top diameter: This part is not applicable for a cup.']);
    expect(watchCode('A5B1O', dictionary).warnings).toEqual(['Basis weight: This part is not applicable for a cup.']);
    expect(watchCode('A5B17O', dictionary).warnings).toEqual([]);
    expect(watchCode('A5B17D', dictionary).warnings).toEqual([]);
    expect(watchCode('A5DB17', dictionary).warnings).toEqual(['Colour / clarity (D) has no value.']);
    expect(watchCode('A5A6', dictionary).warnings).toEqual(['Product type is given twice.']);
  });

  it('does not warn about a number still being typed', () => {
    expect(watchCode('A21S0', dictionary).warnings).toEqual([]);
    expect(watchCode('A5-G1', dictionary).warnings).toEqual([]);
    expect(watchCode('A5-G10', dictionary).warnings).toEqual([]);
  });
});
