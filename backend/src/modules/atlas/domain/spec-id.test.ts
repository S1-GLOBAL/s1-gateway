import { describe, expect, it } from 'vitest';
import type { Result } from '../../../shared/domain/result.js';
import { InvalidSpecIdError } from './spec-id.errors.js';
import { checkSlotValue, SpecId, type SpecIdFactsInput } from './spec-id.js';
import type { DictionarySlotKey, SlotKey } from './slots.js';
import { s2Dictionary } from './testing/s2-dictionary.js';
import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1, withSlot } from './testing/spec-id-codes.js';

const dictionary = s2Dictionary();
const ILLUSTRATIVE_FACTS: SpecIdFactsInput = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};

function parsed(code: string): SpecId {
  const result = SpecId.parse(code, dictionary);
  if (!result.ok) throw new Error(`expected ${code} to parse: ${JSON.stringify(result.error.issues)}`);
  return result.value;
}

function built(facts: SpecIdFactsInput): SpecId {
  const result = SpecId.build(facts, dictionary);
  if (!result.ok) throw new Error(`expected the facts to build: ${JSON.stringify(result.error.issues)}`);
  return result.value;
}

function issuesOf(result: Result<SpecId, InvalidSpecIdError>) {
  if (result.ok) throw new Error(`expected a rejection, got ${result.value.code}`);
  expect(result.error).toBeInstanceOf(InvalidSpecIdError);
  expect(result.error.code).toBe('INVALID_SPEC_ID');
  expect(result.error.message).toBe('The Spec ID is not valid.');
  expect(result.error.details).toEqual({ fields: result.error.issues });
  return result.error.issues;
}

const parseIssues = (code: string) => issuesOf(SpecId.parse(code, dictionary));
const buildIssues = (facts: SpecIdFactsInput) => issuesOf(SpecId.build(facts, dictionary));

function meanings(specId: SpecId): Record<string, string> {
  return Object.fromEntries(specId.describe(dictionary).map((slot) => [slot.key, slot.meaning]));
}

function states(specId: SpecId): Record<string, string> {
  return Object.fromEntries(specId.describe(dictionary).map((slot) => [slot.key, slot.state]));
}

/** The illustrative facts with one slot changed or added. */
const illustrativeWith = (facts: Partial<SpecIdFactsInput>): SpecIdFactsInput => ({ ...ILLUSTRATIVE_FACTS, ...facts });

describe('the illustrative code', () => {
  it('parses into 25 slots read in plain words, product type first', () => {
    const specId = parsed(ILLUSTRATIVE);
    const slots = specId.describe(dictionary);

    expect(specId.code).toBe(ILLUSTRATIVE);
    expect(slots).toHaveLength(25);
    expect(slots.map((slot) => slot.number)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    expect(slots[0]).toEqual({
      number: 1,
      key: 'productType',
      name: 'Product type',
      raw: 'BLD',
      state: 'value',
      meaning: 'Bowl lid',
    });
    expect(slots.find((slot) => slot.key === 'topDiameter')).toMatchObject({ state: 'value', meaning: '90 mm' });
    expect(slots.find((slot) => slot.key === 'unitWeight')).toMatchObject({ state: 'value', meaning: '3.3 g' });
    expect(slots.find((slot) => slot.key === 'height')).toMatchObject({ state: 'not-known', meaning: 'Not known' });
    expect(slots.find((slot) => slot.key === 'capacity')).toMatchObject({
      state: 'does-not-apply',
      meaning: "Doesn't apply",
    });
    expect(slots.at(-1)).toMatchObject({ key: 'variant', name: 'Variant number', state: 'does-not-apply' });
  });

  it('is built from its facts, and parses back to the same code', () => {
    const specId = built(ILLUSTRATIVE_FACTS);
    expect(specId.code).toBe(ILLUSTRATIVE);
    expect(parsed(specId.code).code).toBe(ILLUSTRATIVE);
  });

  it('gives each slot by its key', () => {
    const specId = parsed(ILLUSTRATIVE);
    expect(specId.slot('material')).toBe('APS');
    expect(specId.slot('capacity')).toBe('X');
    expect(specId.slot('height')).toBe('Y');
    expect(specId.slot('variant')).toBe('X');
  });
});

describe('SpecId.parse', () => {
  it('trims surrounding spaces and folds no case', () => {
    expect(parsed(`  ${ILLUSTRATIVE}\n`).code).toBe(ILLUSTRATIVE);
    expect(parseIssues(withSlot(ILLUSTRATIVE, 'productType', 'bld'))).toEqual({
      productType: ['Product type: bld is not in the dictionary.'],
    });
  });

  it('describes capacity, dimensions, weights and thickness in their units', () => {
    const specId = parsed('BWL.BKR.PB.WH.RD.X.Z0006.0090.0060.0045.X.X.X.0040.300.025.Y.Y.Y.X.X.X.X.X.X');
    expect(meanings(specId)).toMatchObject({
      material: 'Paper and paperboard, kraft',
      coating: 'PE both sides',
      capacity: '6 oz',
      topDiameter: '90 mm',
      bottomDiameter: '60 mm',
      height: '45 mm',
      unitWeight: '4 g',
      basisWeight: '300 gsm',
      thickness: '25 µm',
    });
  });

  it('reports every problem with the code at once', () => {
    expect(parseIssues('BLD.APS')).toEqual({
      code: ['A Spec ID has 25 parts separated by dots. This one has 2.'],
    });
    expect(parseIssues('S1.BLD')).toEqual({
      code: ['An S1 Spec ID is 74 characters in 18 parts. This one has 6 characters in 2 parts.'],
    });
  });

  it('reports each broken slot, one message per slot', () => {
    const code = 'BLD.QQQ.Y.CL.RD.DM.Z0006.0X90.X.X.X.X.X.00A3.X.Y.X.Y.X.X.X.X.X.X.01';
    expect(parseIssues(code)).toEqual({
      material: ['Material: QQQ is not in the dictionary.'],
      capacity: ['Nominal capacity must be X for a bowl lid.'],
      topDiameter: ['Top diameter: 0X90 mixes a marker with other characters.'],
      height: ['Height can\'t be "doesn\'t apply" for a bowl lid.'],
      unitWeight: ['Unit weight: 00A3 is not a number.'],
      variant: ['Variant number: 01 is not in the dictionary.'],
    });
  });

  it('checks a slot that failed its own check no further', () => {
    expect(parseIssues(withSlot(ILLUSTRATIVE, 'capacity', 'Q0006'))).toEqual({
      capacity: ['Nominal capacity: Q0006 is not in the dictionary.'],
    });
  });

  it('checks no slot for applicability when the product type is not valid', () => {
    expect(parseIssues(withSlot(withSlot(ILLUSTRATIVE, 'productType', 'ZZZ'), 'capacity', 'Z0006'))).toEqual({
      productType: ['Product type: ZZZ is not in the dictionary.'],
    });
  });

  it("leaves the slots that depend on a shape of X to the shape's own message", () => {
    expect(parseIssues(withSlot(ILLUSTRATIVE, 'shape', 'X'))).toEqual({
      shape: ['Shape can\'t be "doesn\'t apply" for a bowl lid.'],
    });
  });
});

describe('SpecId.build', () => {
  it('writes Y in every slot that applies and X in every slot that never does', () => {
    const specId = built({ productType: 'BLD' });
    expect(specId.code).toBe('BLD.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.X.Y.Y.Y.X.Y.X.X.X.X.X.X.X');

    const back = parsed(specId.code);
    expect(back.code).toBe(specId.code);
    expect(states(back)).toEqual({
      productType: 'value',
      material: 'not-known',
      coating: 'not-known',
      colourClarity: 'not-known',
      shape: 'not-known',
      profile: 'not-known',
      capacity: 'does-not-apply',
      topDiameter: 'not-known',
      bottomDiameter: 'does-not-apply',
      height: 'not-known',
      length: 'not-known',
      width: 'not-known',
      gusset: 'does-not-apply',
      unitWeight: 'not-known',
      basisWeight: 'not-known',
      thickness: 'not-known',
      wall: 'does-not-apply',
      print: 'not-known',
      compartments: 'does-not-apply',
      plies: 'does-not-apply',
      lidOpening: 'does-not-apply',
      handle: 'does-not-apply',
      wrap: 'does-not-apply',
      window: 'does-not-apply',
      variant: 'does-not-apply',
    });
  });

  it('treats a slot given as null as left out', () => {
    expect(built({ productType: 'BLD', material: null, capacity: null, height: null }).code).toBe(
      built({ productType: 'BLD' }).code,
    );
  });

  it('round-trips every product type', () => {
    for (const { code, meaning } of dictionary.valuesOf('productType')) {
      const specId = built({ productType: code });
      expect(parsed(specId.code).code).toBe(specId.code);
      expect(meanings(specId).productType).toBe(meaning);
    }
  });

  it('round-trips every capacity letter on a bowl', () => {
    const labels: Record<string, string> = { Z: 'oz', M: 'mL', S: 'servings', N: 'count', G: 'g' };
    for (const { code } of dictionary.valuesOf('capacity')) {
      const specId = built({ productType: 'BWL', capacity: { unit: code, value: '6' } });
      expect(specId.slot('capacity')).toBe(`${code}0006`);
      expect(parsed(specId.code).code).toBe(specId.code);
      expect(meanings(specId).capacity).toBe(`6 ${labels[code]}`);
    }
  });

  it.each<DictionarySlotKey>(['material', 'coating', 'colourClarity', 'shape', 'profile'])(
    'round-trips every %s on a bowl lid',
    (slot) => {
      for (const { code, meaning } of dictionary.valuesOf(slot)) {
        const specId = built({ productType: 'BLD', [slot]: code });
        expect(specId.slot(slot)).toBe(code);
        expect(parsed(specId.code).code).toBe(specId.code);
        expect(meanings(specId)[slot]).toBe(meaning);
      }
    },
  );

  it('reads a capacity written with zero decimals as the whole number it is', () => {
    expect(built({ productType: 'BWL', capacity: { unit: 'Z', value: '6.0' } }).slot('capacity')).toBe('Z0006');
    expect(built({ productType: 'BWL', capacity: { unit: 'M', value: '500.000' } }).slot('capacity')).toBe('M0500');
  });

  it('makes basis weight not known on paper and X on anything else', () => {
    expect(built({ productType: 'BLD', material: 'B00' }).slot('basisWeight')).toBe('Y');
    expect(built({ productType: 'BLD', material: 'BKR' }).slot('basisWeight')).toBe('Y');
    expect(built({ productType: 'BLD', material: 'APS' }).slot('basisWeight')).toBe('X');
    expect(built({ productType: 'BLD', material: 'APT' }).slot('basisWeight')).toBe('X');
  });

  it('makes the diameter apply to a round shape, and length and width to any other', () => {
    const round = built({ productType: 'BLD', shape: 'RD' });
    expect([round.slot('topDiameter'), round.slot('length'), round.slot('width')]).toEqual(['Y', 'X', 'X']);
    for (const shape of ['SQ', 'RC', 'OV']) {
      const other = built({ productType: 'BLD', shape });
      expect([other.slot('topDiameter'), other.slot('length'), other.slot('width')]).toEqual(['X', 'Y', 'Y']);
    }
  });

  it.each([
    ['height', { value: '1.375', unit: 'in' }, '0035'],
    ['height', { value: '4.25', unit: 'in' }, '0108'],
    ['height', { value: '9', unit: 'cm' }, '0090'],
    ['unitWeight', { value: '3.3', unit: 'g' }, '0033'],
    ['unitWeight', { value: '4', unit: 'g' }, '0040'],
  ] as const)('rounds %s %j half up to %s', (slot, fact, raw) => {
    expect(built({ productType: 'BLD', [slot]: fact }).slot(slot)).toBe(raw);
  });

  it('reports every problem at once', () => {
    expect(
      buildIssues({
        productType: 'BLD',
        material: 'QQQ',
        capacity: { unit: 'Z', value: '6' },
        height: { value: '9O', unit: 'mm' },
        unitWeight: { value: '3.3', unit: 'kg' },
      }),
    ).toEqual({
      material: ['Material: QQQ is not in the dictionary.'],
      capacity: ['Nominal capacity must be X for a bowl lid.'],
      height: ['Height: 9O is not a number.'],
      unitWeight: ['Unit weight: kg is not a unit for this slot. Use g.'],
    });
  });
});

describe('every message the domain produces', () => {
  describe('when decoding', () => {
    it.each<[string, string, Partial<Record<SlotKey | 'code', string[]>>]>([
      ['an empty box', '   ', { code: ['Paste a Spec ID to read it.'] }],
      [
        'the wrong part count',
        ILLUSTRATIVE.replace(/\.(?=X$)/, '-'),
        { code: ['A Spec ID has 25 parts separated by dots. This one has 24.'] },
      ],
      [
        'a tag before the product type',
        `S3.${ILLUSTRATIVE}`,
        { code: ['A Spec ID has 25 parts separated by dots. This one has 26.'] },
      ],
      [
        'a slot of the wrong width',
        withSlot(ILLUSTRATIVE, 'topDiameter', '090'),
        { topDiameter: ['Top diameter: 090 must be 4 characters.'] },
      ],
      [
        'a value not in the dictionary',
        ILLUSTRATIVE.replace('.APS.', '.QQQ.'),
        { material: ['Material: QQQ is not in the dictionary.'] },
      ],
      [
        'a product type of X',
        withSlot(ILLUSTRATIVE, 'productType', 'X'),
        { productType: ['Product type: X is not in the dictionary.'] },
      ],
      [
        'a material of X: material is in every code',
        withSlot(ILLUSTRATIVE, 'material', 'X'),
        { material: ['Material: X is not in the dictionary.'] },
      ],
      [
        'a capacity letter not in the dictionary',
        'BWL.APS.Y.CL.RD.X.Q0006.0090.Y.Y.X.X.X.0033.X.Y.Y.Y.Y.X.X.X.X.X.X',
        { capacity: ['Nominal capacity: Q0006 is not in the dictionary.'] },
      ],
      [
        'a variant other than X',
        withSlot(ILLUSTRATIVE, 'variant', '01'),
        { variant: ['Variant number: 01 is not in the dictionary.'] },
      ],
      [
        'a mixed marker',
        ILLUSTRATIVE.replace('.0090.', '.0X90.'),
        { topDiameter: ['Top diameter: 0X90 mixes a marker with other characters.'] },
      ],
      [
        'a product type not known',
        withSlot(ILLUSTRATIVE, 'productType', 'Y'),
        { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
      ],
      [
        'a value in a slot that never applies',
        withSlot(ILLUSTRATIVE, 'capacity', 'Z0006'),
        { capacity: ['Nominal capacity must be X for a bowl lid.'] },
      ],
      [
        'X in a slot that applies',
        withSlot(ILLUSTRATIVE, 'height', 'X'),
        { height: ['Height can\'t be "doesn\'t apply" for a bowl lid.'] },
      ],
      [
        'a shape not known, reporting every slot that depends on it',
        withSlot(ILLUSTRATIVE, 'shape', 'Y'),
        {
          topDiameter: ['Top diameter must be Y while the shape is not known.'],
          length: ['Length must be Y while the shape is not known.'],
          width: ['Width must be Y while the shape is not known.'],
        },
      ],
      [
        'a material not known',
        withSlot(ILLUSTRATIVE, 'material', 'Y'),
        { basisWeight: ['Basis weight must be Y while the material is not known.'] },
      ],
      [
        'a measurement that is not a number',
        ILLUSTRATIVE.replace('.0033.', '.00A3.'),
        { unitWeight: ['Unit weight: 00A3 is not a number.'] },
      ],
      [
        'a capacity that is not a number',
        'BWL.APS.Y.CL.RD.X.Z00A6.0090.Y.Y.X.X.X.0033.X.Y.Y.Y.Y.X.X.X.X.X.X',
        { capacity: ['Nominal capacity: Z00A6 is not a number.'] },
      ],
      [
        'a capacity of nothing',
        'BWL.APS.Y.CL.RD.X.Z0000.0090.Y.Y.X.X.X.0033.X.Y.Y.Y.Y.X.X.X.X.X.X',
        { capacity: ['Nominal capacity: Z0000 is outside 1–9999 oz.'] },
      ],
    ])('%s', (_case, code, expected) => {
      expect(parseIssues(code)).toEqual(expected);
    });
  });

  describe('when building', () => {
    it.each<[string, SpecIdFactsInput, Partial<Record<SlotKey, string[]>>]>([
      [
        'an empty product type',
        { productType: '' },
        { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
      ],
      [
        'a product type of Y',
        { productType: 'Y' },
        { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
      ],
      [
        'a product type not in the dictionary',
        { productType: 'ZZZ', capacity: { unit: 'Z', value: '6' } },
        { productType: ['Product type: ZZZ is not in the dictionary.'] },
      ],
      ['a marker given as a value', { productType: 'BLD', coating: 'Y' }, { coating: ['Coating: Y is not in the dictionary.'] }],
      [
        'a capacity letter not in the dictionary',
        { productType: 'BWL', capacity: { unit: 'Q', value: '6' } },
        { capacity: ['Nominal capacity: Q is not in the dictionary.'] },
      ],
      [
        'a capacity that is not whole',
        { productType: 'BWL', capacity: { unit: 'Z', value: '6.5' } },
        { capacity: ['Nominal capacity: 6.5 must be a whole number.'] },
      ],
      [
        'a capacity that is not a number',
        { productType: 'BWL', capacity: { unit: 'Z', value: 'six' } },
        { capacity: ['Nominal capacity: six is not a number.'] },
      ],
      [
        'a capacity unit with no amount',
        { productType: 'BWL', capacity: { unit: 'Z', value: '' } },
        { capacity: ['Nominal capacity: type a number.'] },
      ],
      [
        'a capacity of nothing',
        { productType: 'BWL', capacity: { unit: 'M', value: '0' } },
        { capacity: ['Nominal capacity: 0 mL is outside 1–9999 mL.'] },
      ],
      [
        'a wrong unit',
        illustrativeWith({ unitWeight: { value: '3.3', unit: 'kg' } }),
        { unitWeight: ['Unit weight: kg is not a unit for this slot. Use g.'] },
      ],
      [
        'a wrong unit for a dimension',
        illustrativeWith({ height: { value: '3', unit: 'ft' } }),
        { height: ['Height: ft is not a unit for this slot. Use mm, cm or in.'] },
      ],
      [
        'a measurement that is not a number',
        illustrativeWith({ height: { value: '9O', unit: 'mm' } }),
        { height: ['Height: 9O is not a number.'] },
      ],
      [
        'a blank measurement',
        illustrativeWith({ height: { value: '  ', unit: 'mm' } }),
        { height: ['Height: type a number.'] },
      ],
      [
        'a negative measurement',
        illustrativeWith({ height: { value: '-5', unit: 'mm' } }),
        { height: ['Height: -5 is not a number.'] },
      ],
      [
        'too many decimals',
        illustrativeWith({ height: { value: '1.1234567', unit: 'in' } }),
        { height: ['Height: 1.1234567 in has more than 6 decimal places.'] },
      ],
      [
        'a measurement out of range',
        illustrativeWith({ thickness: { value: '0', unit: 'um' } }),
        { thickness: ['Thickness: 0 µm is outside 1–999 µm.'] },
      ],
      [
        'a value in a slot that never applies',
        { productType: 'BWL', shape: 'RD', profile: 'DM' },
        { profile: ['Profile must be X for a bowl.'] },
      ],
      [
        'a value in a slot that never applies, on a stand-up pouch',
        { productType: 'SUP', shape: 'RD' },
        { shape: ['Shape must be X for a stand-up pouch.'] },
      ],
      [
        'a shape not known, reporting every slot that depends on it',
        {
          productType: 'BLD',
          topDiameter: { value: '90', unit: 'mm' },
          length: { value: '100', unit: 'mm' },
          width: { value: '80', unit: 'mm' },
        },
        {
          topDiameter: ['Top diameter must be Y while the shape is not known.'],
          length: ['Length must be Y while the shape is not known.'],
          width: ['Width must be Y while the shape is not known.'],
        },
      ],
      [
        'a material not known',
        { productType: 'BLD', basisWeight: { value: '300', unit: 'gsm' } },
        { basisWeight: ['Basis weight must be Y while the material is not known.'] },
      ],
    ])('%s', (_case, facts, expected) => {
      expect(buildIssues(facts)).toEqual(expected);
    });
  });
});

describe('the limits', () => {
  it('refuses a value wider than its slot, whatever the length of the code', () => {
    expect(parseIssues(withSlot(ILLUSTRATIVE, 'unitWeight', '00033'))).toEqual({
      unitWeight: ['Unit weight: 00033 must be 4 characters.'],
    });
  });

  it('reads 25 parts and refuses 26', () => {
    expect(parsed(ILLUSTRATIVE).describe(dictionary)).toHaveLength(25);
    expect(parseIssues(`${ILLUSTRATIVE}.X`)).toEqual({
      code: ['A Spec ID has 25 parts separated by dots. This one has 26.'],
    });
  });

  it('builds a 25-part code for every product type, with Y or X in every empty slot', () => {
    for (const { code } of dictionary.valuesOf('productType')) {
      const parts = built({ productType: code }).code.split('.');
      expect(parts).toHaveLength(25);
      expect(parts[0]).toBe(code);
      expect(parts.slice(1).every((part) => part === 'Y' || part === 'X'), code).toBe(true);
    }
  });

  it.each<[string, SpecIdFactsInput, SlotKey, string]>([
    ['9999 mm', { productType: 'BLD', height: { value: '9999', unit: 'mm' } }, 'height', '9999'],
    ['0.5 mm', { productType: 'BLD', height: { value: '0.5', unit: 'mm' } }, 'height', '0001'],
    ['999.9 g', { productType: 'BLD', unitWeight: { value: '999.9', unit: 'g' } }, 'unitWeight', '9999'],
    ['0.05 g', { productType: 'BLD', unitWeight: { value: '0.05', unit: 'g' } }, 'unitWeight', '0001'],
    [
      '999 gsm',
      { productType: 'BLD', material: 'BKR', basisWeight: { value: '999', unit: 'gsm' } },
      'basisWeight',
      '999',
    ],
    ['999 µm', { productType: 'BLD', thickness: { value: '999', unit: 'um' } }, 'thickness', '999'],
    ['9999 oz', { productType: 'BWL', capacity: { unit: 'Z', value: '9999' } }, 'capacity', 'Z9999'],
    ['6 decimal places', { productType: 'BLD', height: { value: '1.123456', unit: 'in' } }, 'height', '0029'],
  ])('builds %s at the limit', (_case, facts, slot, raw) => {
    const specId = built(facts);
    expect(specId.slot(slot)).toBe(raw);
    expect(parsed(specId.code).code).toBe(specId.code);
  });

  it.each<[SpecIdFactsInput, Partial<Record<SlotKey, string[]>>]>([
    [
      { productType: 'BLD', height: { value: '9999.5', unit: 'mm' } },
      { height: ['Height: 9999.5 mm is outside 1–9999 mm.'] },
    ],
    [
      { productType: 'BLD', height: { value: '0.4999', unit: 'mm' } },
      { height: ['Height: 0.4999 mm is outside 1–9999 mm.'] },
    ],
    [
      { productType: 'BLD', unitWeight: { value: '999.95', unit: 'g' } },
      { unitWeight: ['Unit weight: 999.95 g is outside 0.1–999.9 g.'] },
    ],
    [
      { productType: 'BLD', unitWeight: { value: '0.04', unit: 'g' } },
      { unitWeight: ['Unit weight: 0.04 g is outside 0.1–999.9 g.'] },
    ],
    [
      { productType: 'BLD', material: 'BKR', basisWeight: { value: '1000', unit: 'gsm' } },
      { basisWeight: ['Basis weight: 1000 gsm is outside 1–999 gsm.'] },
    ],
    [
      { productType: 'BLD', thickness: { value: '1000', unit: 'um' } },
      { thickness: ['Thickness: 1000 µm is outside 1–999 µm.'] },
    ],
    [
      { productType: 'BWL', capacity: { unit: 'Z', value: '10000' } },
      { capacity: ['Nominal capacity: 10000 oz is outside 1–9999 oz.'] },
    ],
    [
      { productType: 'BLD', height: { value: '1.1234567', unit: 'in' } },
      { height: ['Height: 1.1234567 in has more than 6 decimal places.'] },
    ],
  ])('refuses one over the limit: %j', (facts, expected) => {
    expect(buildIssues(facts)).toEqual(expected);
  });
});

describe('checkSlotValue', () => {
  it('checks one slot on its own, giving the first problem or nothing', () => {
    expect(checkSlotValue('topDiameter', '0090', dictionary)).toBeUndefined();
    expect(checkSlotValue('topDiameter', 'Y', dictionary)).toBeUndefined();
    expect(checkSlotValue('topDiameter', 'X', dictionary)).toBeUndefined();
    expect(checkSlotValue('topDiameter', '0X9', dictionary)).toBe('Top diameter: 0X9 must be 4 characters.');
    expect(checkSlotValue('shape', 'RD', dictionary)).toBeUndefined();
    expect(checkSlotValue('shape', 'ZZ', dictionary)).toBe('Shape: ZZ is not in the dictionary.');
    expect(checkSlotValue('productType', 'Y', dictionary)).toBe(
      'Product type can\'t be "not known": it decides which slots apply.',
    );
    expect(checkSlotValue('capacity', 'M0500', dictionary)).toBeUndefined();
  });
});

describe('codes given out before', () => {
  it('reads an S1 code as the short code it converts to', () => {
    expect(parsed(ILLUSTRATIVE_S1).code).toBe(ILLUSTRATIVE);
    expect(parsed(`  ${ILLUSTRATIVE_S1} `).code).toBe(ILLUSTRATIVE);
  });

  it('reads a long S2 code as the short code it converts to', () => {
    expect(parsed(ILLUSTRATIVE_LONG).code).toBe(ILLUSTRATIVE);
  });

  it('reads a marker written as wide as its slot as its one letter', () => {
    expect(parsed(withSlot(ILLUSTRATIVE, 'height', '0000')).code).toBe(ILLUSTRATIVE);
    expect(parsed(withSlot(ILLUSTRATIVE, 'capacity', 'XXXXX')).code).toBe(ILLUSTRATIVE);
  });

  it('says what an S1 code must be when it cannot be converted', () => {
    expect(parseIssues(ILLUSTRATIVE_S1.replace('.0033.', '.033.'))).toEqual({
      code: ['An S1 Spec ID is 74 characters in 18 parts. This one has 73 characters in 18 parts.'],
    });
    expect(parseIssues(ILLUSTRATIVE_S1.replace('.BLD.', '.CUP.'))).toEqual({
      productType: ['Product type: CUP is not in the dictionary.'],
    });
  });
});

describe('the slots S2 added', () => {
  /** A product type each added slot applies to, and a value it can hold. */
  const CASES: readonly [keyof SpecIdFactsInput, string, string][] = [
    ['wall', 'CUP', 'DW'],
    ['print', 'CUP', '02'],
    ['compartments', 'CTN', '3'],
    ['plies', 'NPK', '2'],
    ['lidOpening', 'CLD', 'SP'],
    ['handle', 'BAG', 'TW'],
    ['wrap', 'STW', 'PW'],
    ['window', 'BAG', 'WN'],
  ];

  it.each(CASES)('makes %s part of the code: one different fact, one different code', (slot, productType, value) => {
    const without = built({ productType });
    const withIt = built({ productType, [slot]: value });
    expect(withIt.code).not.toBe(without.code);
    expect(parsed(withIt.code).code).toBe(withIt.code);
  });

  it('pads a count to its slot and reads it in words', () => {
    const tray = built({ productType: 'CTN', compartments: '3' });
    expect(tray.slot('compartments')).toBe('03');
    expect(meanings(tray).compartments).toBe('3 compartments');
    expect(meanings(built({ productType: 'CTN', compartments: '1' })).compartments).toBe('1 compartment');
    const napkin = built({ productType: 'NPK', plies: '2' });
    expect(napkin.slot('plies')).toBe('2');
    expect(meanings(napkin).plies).toBe('2 plies');
    expect(meanings(built({ productType: 'NPK', plies: '1' })).plies).toBe('1 ply');
  });

  it.each([
    [{ productType: 'CTN', compartments: '13' }, { compartments: ['Compartments: 13 is outside 1–12.'] }],
    [{ productType: 'CTN', compartments: '0' }, { compartments: ['Compartments: 0 is outside 1–12.'] }],
    [{ productType: 'CTN', compartments: 'two' }, { compartments: ['Compartments: two is not a number.'] }],
    [{ productType: 'NPK', plies: '5' }, { plies: ['Plies: 5 is outside 1–4.'] }],
  ] as const)('refuses the count %j', (facts, expected) => {
    expect(buildIssues(facts)).toEqual(expected);
  });

  it('reads a coating of WC and a material of BWP, and refuses WX as a broken marker', () => {
    expect(built({ productType: 'CUP', coating: 'WC', material: 'BWP' }).slot('coating')).toBe('WC');
    const waxed = built({ productType: 'CUP', coating: 'WC' }).code;
    expect(parseIssues(withSlot(waxed, 'coating', 'WX'))).toEqual({
      coating: ['Coating: WX mixes a marker with other characters.'],
    });
  });

  it('refuses a value in a slot the rules mark never, for every product type', () => {
    for (const { code, meaning } of dictionary.valuesOf('productType')) {
      const never = dictionary.slotRules().find((rule) => rule.productType === code && rule.rule === 'never');
      expect(never, `${code} has a slot that never applies`).toBeDefined();
      if (!never) continue;
      const facts = { productType: code, [never.slot]: valueFor(never.slot) } as SpecIdFactsInput;
      const issues = buildIssues(facts);
      expect(issues[never.slot]?.[0]).toMatch(new RegExp(`must be X for a ${meaning.toLowerCase().replace(/[()]/g, '\\$&')}\\.$`));
    }
  });
});

/** A value a slot can hold, whatever its kind. */
function valueFor(slot: SlotKey): SpecIdFactsInput[keyof SpecIdFactsInput] {
  switch (slot) {
    case 'capacity':
      return { unit: 'Z', value: '6' };
    case 'compartments':
    case 'plies':
      return '2';
    case 'unitWeight':
      return { value: '3', unit: 'g' };
    case 'basisWeight':
      return { value: '100', unit: 'gsm' };
    case 'thickness':
      return { value: '30', unit: 'um' };
    case 'topDiameter':
    case 'bottomDiameter':
    case 'height':
    case 'length':
    case 'width':
    case 'gusset':
      return { value: '50', unit: 'mm' };
    default:
      return dictionary.valuesOf(slot as DictionarySlotKey)[0]?.code ?? '';
  }
}
