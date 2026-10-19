import { describe, expect, it } from 'vitest';
import { fromS1, S1_ADDED_SLOTS, storedForms, toS1 } from './s1-code.js';
import { RULED_SLOTS } from './slots.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

/** The specification's illustrative bowl lid, in both formats. Every other value here is invented. */
const S1 = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const S2 = 'S2.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX.00.XX.X.XX.XX.XX.XX.XX';

describe('fromS1', () => {
  it('keeps slots 1-17, adds the eight slots for the product type, then the variant', () => {
    expect(fromS1(S1)).toBe(S2);
    expect(fromS1(S1)).toHaveLength(97);
  });

  it.each([
    ['BLD', 'XX.00.XX.X.XX.XX.XX.XX'],
    ['CLD', 'XX.00.XX.X.00.XX.XX.XX'],
    ['BWL', '00.00.00.X.XX.XX.XX.XX'],
    ['SUP', 'XX.00.XX.X.XX.XX.XX.00'],
  ])('adds %s its eight slots as %s', (productType, added) => {
    const code = S1.replace('.BLD.', `.${productType}.`);
    expect(fromS1(code)).toBe(`S2${code.slice(2, 71)}.${added}.XX`);
  });

  it('converts nothing that is not a whole S1 code of an S1 product type', () => {
    expect(fromS1(S2)).toBeNull();
    expect(fromS1(S1.slice(0, -3))).toBeNull();
    expect(fromS1(S1.replace('.0033.', '.033.'))).toBeNull();
    expect(fromS1(S1.replace('.BLD.', '.CUP.'))).toBeNull();
    expect(fromS1(S1.toLowerCase())).toBeNull();
  });
});

describe('toS1', () => {
  it('gives back the S1 code an S2 code was converted from', () => {
    expect(toS1(S2)).toBe(S1);
  });

  it('gives nothing for an S2 code S1 could not have written', () => {
    expect(toS1(S2.replace('.XX.00.XX.X.', '.XX.02.XX.X.'))).toBeNull();
    expect(toS1(S2.replace('.BLD.', '.CUP.'))).toBeNull();
    expect(toS1(S1)).toBeNull();
  });
});

describe('storedForms', () => {
  it('names both forms when the code has an S1 form, and itself alone otherwise', () => {
    expect(storedForms(S2)).toEqual([S2, S1]);
    const printed = S2.replace('.XX.00.XX.X.', '.XX.02.XX.X.');
    expect(storedForms(printed)).toEqual([printed]);
  });
});

describe('S1_ADDED_SLOTS', () => {
  it('fills each added slot as S2 0.1.0 rules it: X where it never applies, 0 where it does', () => {
    const dictionary = s2Dictionary();
    const added = RULED_SLOTS.slice(-8);
    for (const [productType, slots] of Object.entries(S1_ADDED_SLOTS)) {
      const expected = added.map((slot) => {
        const rule = dictionary.ruleFor(productType, slot);
        const width = slot === 'plies' ? 1 : 2;
        return (rule === 'never' ? 'X' : '0').repeat(width);
      });
      expect(slots.split('.'), productType).toEqual(expected);
    }
  });
});
