import { describe, expect, it } from 'vitest';
import type { Result } from '../../../shared/domain/result.js';
import { InvalidSpecIdError } from './spec-id.errors.js';
import { checkSlotValue, SpecId, type SpecIdFactsInput } from './spec-id.js';
import type { DictionarySlotKey, SlotKey } from './slots.js';
import { s1Dictionary } from './testing/s1-dictionary.js';

const dictionary = s1Dictionary();

/** The specification's illustrative bowl lid. Every other value here is invented. */
const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
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
  it('parses into 18 slots read in plain words', () => {
    const specId = parsed(ILLUSTRATIVE);
    const slots = specId.describe(dictionary);

    expect(specId.code).toBe(ILLUSTRATIVE);
    expect(slots).toHaveLength(18);
    expect(slots.map((slot) => slot.number)).toEqual(Array.from({ length: 18 }, (_, index) => index + 1));
    expect(slots[0]).toEqual({
      number: 1,
      key: 'formatVersion',
      name: 'Format version',
      raw: 'S1',
      state: 'value',
      meaning: 'S1',
    });
    expect(slots.find((slot) => slot.key === 'productType')).toMatchObject({ raw: 'BLD', meaning: 'Bowl lid' });
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
    expect(specId.slot('capacity')).toBe('XXXXX');
    expect(specId.slot('variant')).toBe('XX');
  });
});

describe('SpecId.parse', () => {
  it('trims surrounding spaces and folds no case', () => {
    expect(parsed(`  ${ILLUSTRATIVE}\n`).code).toBe(ILLUSTRATIVE);
    expect(parseIssues(ILLUSTRATIVE.replace('S1.', 's1.'))).toEqual({
      formatVersion: ['Only S1 codes can be read here. This code starts with s1.'],
    });
    expect(parseIssues(ILLUSTRATIVE.replace('.BLD.', '.bld.'))).toEqual({
      productType: ['Product type: bld is not in the dictionary.'],
    });
  });

  it('describes capacity, dimensions, weights and thickness in their units', () => {
    const specId = parsed('S1.BWL.BKR.PB.WH.RD.XX.Z0006.0090.0060.0045.XXXX.XXXX.XXXX.0040.300.025.XX');
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
    expect(parseIssues('S1.BLD')).toEqual({
      code: ['A Spec ID is 74 characters. This one has 6.', 'A Spec ID has 18 parts separated by dots. This one has 2.'],
    });
  });

  it('reports each broken slot, one message per slot', () => {
    const code = 'S1.BLD.QQQ.00.CL.RD.DM.Z0006.0X90.XXXX.XXXX.XXXX.XXXX.XXXX.00A3.XXX.000.01';
    expect(parseIssues(code)).toEqual({
      material: ['Material: QQQ is not in the dictionary.'],
      capacity: ['Nominal capacity must be XXXXX for a bowl lid.'],
      topDiameter: ['Top diameter: 0X90 mixes a marker with other characters.'],
      height: ['Height can\'t be "doesn\'t apply" for a bowl lid.'],
      unitWeight: ['Unit weight: 00A3 is not a number.'],
      variant: ['Variant number: 01 is not in the dictionary.'],
    });
  });

  it('checks a slot that failed its own check no further', () => {
    expect(parseIssues(ILLUSTRATIVE.replace('.XXXXX.', '.Q0006.'))).toEqual({
      capacity: ['Nominal capacity: Q0006 is not in the dictionary.'],
    });
  });

  it('checks no slot for applicability when the product type is not valid', () => {
    expect(parseIssues(ILLUSTRATIVE.replace('.BLD.', '.ZZZ.').replace('.XXXXX.', '.Z0006.'))).toEqual({
      productType: ['Product type: ZZZ is not in the dictionary.'],
    });
  });

  it('leaves the slots that depend on a shape of X to the shape’s own message', () => {
    expect(parseIssues(ILLUSTRATIVE.replace('.RD.', '.XX.'))).toEqual({
      shape: ['Shape can\'t be "doesn\'t apply" for a bowl lid.'],
    });
  });
});

describe('SpecId.build', () => {
  it('writes 0 in every slot that applies and X in every slot that never does', () => {
    const specId = built({ productType: 'BLD' });
    expect(specId.code).toBe('S1.BLD.000.00.00.00.00.XXXXX.0000.XXXX.0000.0000.0000.XXXX.0000.000.000.XX');

    const back = parsed(specId.code);
    expect(back.code).toBe(specId.code);
    expect(states(back)).toEqual({
      formatVersion: 'value',
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

  it('makes basis weight not known on paper and X on anything else', () => {
    expect(built({ productType: 'BLD', material: 'B00' }).slot('basisWeight')).toBe('000');
    expect(built({ productType: 'BLD', material: 'BKR' }).slot('basisWeight')).toBe('000');
    expect(built({ productType: 'BLD', material: 'APS' }).slot('basisWeight')).toBe('XXX');
    expect(built({ productType: 'BLD', material: 'APT' }).slot('basisWeight')).toBe('XXX');
  });

  it('makes the diameter apply to a round shape, and length and width to any other', () => {
    const round = built({ productType: 'BLD', shape: 'RD' });
    expect([round.slot('topDiameter'), round.slot('length'), round.slot('width')]).toEqual(['0000', 'XXXX', 'XXXX']);
    for (const shape of ['SQ', 'RC', 'OV']) {
      const other = built({ productType: 'BLD', shape });
      expect([other.slot('topDiameter'), other.slot('length'), other.slot('width')]).toEqual(['XXXX', '0000', '0000']);
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
      capacity: ['Nominal capacity must be XXXXX for a bowl lid.'],
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
        ILLUSTRATIVE.replace(/\.(?=XX$)/, '-'),
        { code: ['A Spec ID has 18 parts separated by dots. This one has 17.'] },
      ],
      [
        'another version',
        ILLUSTRATIVE.replace('S1.', 'S2.'),
        { formatVersion: ['Only S1 codes can be read here. This code starts with S2.'] },
      ],
      [
        'a slot of the wrong width',
        ILLUSTRATIVE.replace('.0090.', '.090.'),
        { code: ['A Spec ID is 74 characters. This one has 73.'], topDiameter: ['Top diameter: 090 must be 4 characters.'] },
      ],
      [
        'a value not in the dictionary',
        ILLUSTRATIVE.replace('.APS.', '.QQQ.'),
        { material: ['Material: QQQ is not in the dictionary.'] },
      ],
      [
        'a product type of X',
        ILLUSTRATIVE.replace('.BLD.', '.XXX.'),
        { productType: ['Product type: XXX is not in the dictionary.'] },
      ],
      [
        'a capacity letter not in the dictionary',
        'S1.BWL.APS.00.CL.RD.XX.Q0006.0090.0000.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX',
        { capacity: ['Nominal capacity: Q0006 is not in the dictionary.'] },
      ],
      [
        'a variant other than XX',
        ILLUSTRATIVE.replace(/XX$/, '01'),
        { variant: ['Variant number: 01 is not in the dictionary.'] },
      ],
      [
        'a mixed marker',
        ILLUSTRATIVE.replace('.0090.', '.0X90.'),
        { topDiameter: ['Top diameter: 0X90 mixes a marker with other characters.'] },
      ],
      [
        'a product type of 000',
        ILLUSTRATIVE.replace('.BLD.', '.000.'),
        { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
      ],
      [
        'a value in a slot that never applies',
        ILLUSTRATIVE.replace('.XXXXX.', '.Z0006.'),
        { capacity: ['Nominal capacity must be XXXXX for a bowl lid.'] },
      ],
      [
        'X in a slot that applies',
        ILLUSTRATIVE.replace('.0000.XXXX.XXXX.XXXX.', '.XXXX.XXXX.XXXX.XXXX.'),
        { height: ['Height can\'t be "doesn\'t apply" for a bowl lid.'] },
      ],
      [
        'a shape not known, reporting every slot that depends on it',
        ILLUSTRATIVE.replace('.RD.', '.00.'),
        {
          topDiameter: ['Top diameter must be 0000 while the shape is not known.'],
          length: ['Length must be 0000 while the shape is not known.'],
          width: ['Width must be 0000 while the shape is not known.'],
        },
      ],
      [
        'a material not known',
        ILLUSTRATIVE.replace('.APS.', '.000.'),
        { basisWeight: ['Basis weight must be 000 while the material is not known.'] },
      ],
      [
        'a measurement that is not a number',
        ILLUSTRATIVE.replace('.0033.', '.00A3.'),
        { unitWeight: ['Unit weight: 00A3 is not a number.'] },
      ],
      [
        'a capacity that is not a number',
        'S1.BWL.APS.00.CL.RD.XX.Z00A6.0090.0000.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX',
        { capacity: ['Nominal capacity: Z00A6 is not a number.'] },
      ],
      [
        'a capacity of nothing',
        'S1.BWL.APS.00.CL.RD.XX.Z0000.0090.0000.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX',
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
        'a product type of 000',
        { productType: '000' },
        { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
      ],
      [
        'a product type not in the dictionary',
        { productType: 'ZZZ', capacity: { unit: 'Z', value: '6' } },
        { productType: ['Product type: ZZZ is not in the dictionary.'] },
      ],
      ['a marker given as a value', { productType: 'BLD', coating: '00' }, { coating: ['Coating: 00 is not in the dictionary.'] }],
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
        { profile: ['Profile must be XX for a bowl.'] },
      ],
      [
        'a value in a slot that never applies, on a stand-up pouch',
        { productType: 'SUP', shape: 'RD' },
        { shape: ['Shape must be XX for a stand-up pouch.'] },
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
          topDiameter: ['Top diameter must be 0000 while the shape is not known.'],
          length: ['Length must be 0000 while the shape is not known.'],
          width: ['Width must be 0000 while the shape is not known.'],
        },
      ],
      [
        'a material not known',
        { productType: 'BLD', basisWeight: { value: '300', unit: 'gsm' } },
        { basisWeight: ['Basis weight must be 000 while the material is not known.'] },
      ],
    ])('%s', (_case, facts, expected) => {
      expect(buildIssues(facts)).toEqual(expected);
    });
  });
});

describe('the limits', () => {
  it('reads 74 characters and refuses 75', () => {
    expect(parsed(ILLUSTRATIVE).code).toHaveLength(74);
    expect(parseIssues(ILLUSTRATIVE.replace('.0033.', '.00033.')).code).toEqual([
      'A Spec ID is 74 characters. This one has 75.',
    ]);
  });

  it('reads 18 parts and refuses 19', () => {
    expect(parsed(ILLUSTRATIVE).describe(dictionary)).toHaveLength(18);
    expect(parseIssues(`${ILLUSTRATIVE.slice(0, -3)}.X.XX`)).toEqual({
      code: ['A Spec ID is 74 characters. This one has 76.', 'A Spec ID has 18 parts separated by dots. This one has 19.'],
    });
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
    expect(checkSlotValue('topDiameter', '0000', dictionary)).toBeUndefined();
    expect(checkSlotValue('topDiameter', 'XXXX', dictionary)).toBeUndefined();
    expect(checkSlotValue('topDiameter', '0X9', dictionary)).toBe('Top diameter: 0X9 must be 4 characters.');
    expect(checkSlotValue('shape', 'RD', dictionary)).toBeUndefined();
    expect(checkSlotValue('shape', 'ZZ', dictionary)).toBe('Shape: ZZ is not in the dictionary.');
    expect(checkSlotValue('productType', '000', dictionary)).toBe(
      'Product type can\'t be "not known": it decides which slots apply.',
    );
    expect(checkSlotValue('capacity', 'M0500', dictionary)).toBeUndefined();
  });
});
