import { describe, expect, it } from 'vitest';
import { fromS1, S1_ADDED_SLOTS, shortForm, storedForms, toLong, toShort } from './old-codes.js';
import { RULED_SLOTS } from './slots.js';
import { s2Dictionary } from './testing/s2-dictionary.js';
import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1, withSlot } from './testing/spec-id-codes.js';

describe('fromS1', () => {
  it('keeps slots 2-17, adds the eight slots for the product type, then the variant, in the long form', () => {
    expect(fromS1(ILLUSTRATIVE_S1)).toBe(ILLUSTRATIVE_LONG);
  });

  it.each([
    ['BLD', 'XX.00.XX.X.XX.XX.XX.XX'],
    ['CLD', 'XX.00.XX.X.00.XX.XX.XX'],
    ['BWL', '00.00.00.X.XX.XX.XX.XX'],
    ['SUP', 'XX.00.XX.X.XX.XX.XX.00'],
  ])('adds %s its eight slots as %s', (productType, added) => {
    const code = ILLUSTRATIVE_S1.replace('.BLD.', `.${productType}.`);
    expect(fromS1(code)).toBe(`S2${code.slice(2, 71)}.${added}.XX`);
  });

  it('converts nothing that is not a whole S1 code of an S1 product type', () => {
    expect(fromS1(ILLUSTRATIVE_LONG)).toBeNull();
    expect(fromS1(ILLUSTRATIVE_S1.slice(0, -3))).toBeNull();
    expect(fromS1(ILLUSTRATIVE_S1.replace('.0033.', '.033.'))).toBeNull();
    expect(fromS1(ILLUSTRATIVE_S1.replace('.BLD.', '.CUP.'))).toBeNull();
    expect(fromS1(ILLUSTRATIVE_S1.toLowerCase())).toBeNull();
  });
});

describe('toShort', () => {
  it('drops the tag of a long code and writes each marker as one letter', () => {
    expect(toShort(ILLUSTRATIVE_LONG)).toBe(ILLUSTRATIVE);
  });

  it('converts an S1 code to the short code with the same facts, for each S1 product type', () => {
    expect(toShort(ILLUSTRATIVE_S1)).toBe(ILLUSTRATIVE);
    expect(toShort('S1.CLD.APT.00.CL.RD.FL.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0021.XXX.000.XX')).toBe(
      'CLD.APT.Y.CL.RD.FL.X.0090.X.Y.X.X.X.0021.X.Y.X.Y.X.X.Y.X.X.X.X',
    );
    expect(toShort('S1.BWL.BKR.PB.WH.RD.XX.Z0016.0150.0120.0060.XXXX.XXXX.XXXX.0100.300.000.XX')).toBe(
      'BWL.BKR.PB.WH.RD.X.Z0016.0150.0120.0060.X.X.X.0100.300.Y.Y.Y.Y.X.X.X.X.X.X',
    );
    expect(toShort('S1.SUP.B00.00.BR.XX.XX.Z0012.XXXX.XXXX.0250.XXXX.0160.0080.0000.000.000.XX')).toBe(
      'SUP.B00.Y.BR.X.X.Z0012.X.X.0250.X.0160.0080.Y.Y.Y.X.Y.X.X.X.X.X.Y.X',
    );
  });

  it('keeps a value with zeros inside it, which is no marker', () => {
    expect(toShort(ILLUSTRATIVE_LONG.replace('.APS.', '.B00.'))).toBe(withSlot(ILLUSTRATIVE, 'material', 'B00'));
  });

  it('converts nothing that was not given out before: a short code, or an S1 code it cannot read', () => {
    expect(toShort(ILLUSTRATIVE)).toBeNull();
    expect(toShort('S1.BLD')).toBeNull();
  });
});

describe('shortForm', () => {
  it('gives any code text in the short form, a short code as it is', () => {
    expect(shortForm(ILLUSTRATIVE)).toBe(ILLUSTRATIVE);
    expect(shortForm(ILLUSTRATIVE_LONG)).toBe(ILLUSTRATIVE);
    expect(shortForm(ILLUSTRATIVE_S1)).toBe(ILLUSTRATIVE);
    expect(shortForm(withSlot(ILLUSTRATIVE, 'height', '0000'))).toBe(ILLUSTRATIVE);
  });
});

describe('toLong', () => {
  it('writes a short code back in the long form, each marker as wide as its slot', () => {
    expect(toLong(ILLUSTRATIVE)).toBe(ILLUSTRATIVE_LONG);
    expect(toShort(toLong(ILLUSTRATIVE) ?? '')).toBe(ILLUSTRATIVE);
  });

  it('writes nothing for text that is not 25 parts', () => {
    expect(toLong('BLD.APS')).toBeNull();
    expect(toLong(ILLUSTRATIVE_LONG)).toBeNull();
  });
});

describe('storedForms', () => {
  it('names the short form and the long form an older API wrote during a deploy', () => {
    expect(storedForms(ILLUSTRATIVE)).toEqual([ILLUSTRATIVE, ILLUSTRATIVE_LONG]);
    expect(storedForms('BLD.APS')).toEqual(['BLD.APS']);
  });
});

describe('S1_ADDED_SLOTS', () => {
  it('fills each added slot as S2 0.1.0 rules it: X where it never applies, not known where it does', () => {
    const dictionary = s2Dictionary();
    const added = RULED_SLOTS.slice(-8);
    for (const [productType, slots] of Object.entries(S1_ADDED_SLOTS)) {
      const expected = added.map((slot) => {
        // S1 named product types by letters: each is read as the product type that had them (ADR 0033).
        const rule = dictionary.ruleFor(dictionary.fromLetters('productType', productType) ?? productType, slot);
        const width = slot === 'plies' ? 1 : 2;
        return (rule === 'never' ? 'X' : '0').repeat(width);
      });
      expect(slots.split('.'), productType).toEqual(expected);
    }
  });
});
