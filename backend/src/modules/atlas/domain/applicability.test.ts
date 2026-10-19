import { describe, expect, it } from 'vitest';
import { expectedFill, type ExpectedFill } from './applicability.js';
import { RULED_SLOTS } from './slots.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

const dictionary = s2Dictionary();

/** `A` any, `X` doesn't apply, `0` not known: one letter per ruled slot, in slot order. */
function fills(productType: string, shape: string, material: string): string {
  return RULED_SLOTS.map((key) => {
    const expected = expectedFill(dictionary, productType, key, shape, material);
    if (!expected) return '-';
    return { any: 'A', 'does-not-apply': 'X', 'not-known': '0' }[expected.fill];
  }).join(' ');
}

describe('expectedFill', () => {
  describe('follows each row of the table', () => {
    it.each<[string, string, Parameters<typeof expectedFill>[2], string, string, ExpectedFill | null]>([
      ['applies', 'BLD', 'height', 'SQ', 'APS', { fill: 'any' }],
      ['never', 'BLD', 'capacity', 'RD', 'APS', { fill: 'does-not-apply' }],
      ['round_only, shape not known', 'BLD', 'topDiameter', '00', 'APS', { fill: 'not-known', dependsOn: 'shape' }],
      ['round_only, round', 'BLD', 'topDiameter', 'RD', 'APS', { fill: 'any' }],
      ['round_only, not round', 'BLD', 'topDiameter', 'OV', 'APS', { fill: 'does-not-apply' }],
      ['non_round_only, shape not known', 'BWL', 'length', '00', 'APS', { fill: 'not-known', dependsOn: 'shape' }],
      ['non_round_only, round', 'BWL', 'length', 'RD', 'APS', { fill: 'does-not-apply' }],
      ['non_round_only, not round', 'BWL', 'width', 'RC', 'APS', { fill: 'any' }],
      ['paper_only, material not known', 'CLD', 'basisWeight', 'RD', '000', { fill: 'not-known', dependsOn: 'material' }],
      ['paper_only, paper', 'CLD', 'basisWeight', 'RD', 'B00', { fill: 'any' }],
      ['paper_only, not paper', 'CLD', 'basisWeight', 'RD', 'APT', { fill: 'does-not-apply' }],
    ])('%s', (_row, productType, key, shape, material, expected) => {
      expect(expectedFill(dictionary, productType, key, shape, material)).toEqual(expected);
    });
  });

  describe('for each product type', () => {
    //                          coating colour shape profile capacity top bottom height length width gusset unit basis thick
    //                          wall print compartments plies lid-opening handle wrap window
    it.each([
      ['BLD', 'RD', 'APS', 'A A A A X A X A X X X A X A X A X X X X X X'],
      ['BLD', 'SQ', 'BKR', 'A A A A X X X A A A X A A A X A X X X X X X'],
      ['BLD', '00', '000', 'A A A A X 0 X A 0 0 X A 0 A X A X X X X X X'],
      ['CLD', 'RD', 'APS', 'A A A A X A X A X X X A X A X A X X A X X X'],
      ['CLD', 'OV', 'B00', 'A A A A X X X A A A X A A A X A X X A X X X'],
      ['CLD', '00', '000', 'A A A A X 0 X A 0 0 X A 0 A X A X X A X X X'],
      ['BWL', 'RD', 'APT', 'A A A X A A A A X X X A X A A A A X X X X X'],
      ['BWL', 'RC', 'BKR', 'A A A X A X X A A A X A A A A A A X X X X X'],
      ['BWL', '00', '000', 'A A A X A 0 0 A 0 0 X A 0 A A A A X X X X X'],
      ['SUP', 'XX', 'APS', 'A A X X A X X A X A A A A A X A X X X X X A'],
      ['SUP', 'XX', 'BKR', 'A A X X A X X A X A A A A A X A X X X X X A'],
      ['SUP', 'XX', '000', 'A A X X A X X A X A A A A A X A X X X X X A'],
    ])('%s with shape %s and material %s', (productType, shape, material, expected) => {
      expect(fills(productType, shape, material)).toBe(expected);
    });

    it('fills basis weight on a stand-up pouch whatever the material', () => {
      for (const material of ['APS', 'APT', 'B00', 'BKR', '000']) {
        expect(expectedFill(dictionary, 'SUP', 'basisWeight', 'XX', material)).toEqual({ fill: 'any' });
      }
    });
  });

  describe('skips a slot whose shape or material has its own problem', () => {
    it('skips shape-dependent slots when the shape failed a check or is X', () => {
      expect(expectedFill(dictionary, 'BLD', 'topDiameter', undefined, 'APS')).toBeNull();
      expect(expectedFill(dictionary, 'BLD', 'length', 'XX', 'APS')).toBeNull();
      expect(expectedFill(dictionary, 'BWL', 'bottomDiameter', undefined, 'APS')).toBeNull();
    });

    it('skips material-dependent slots when the material failed a check or is X', () => {
      expect(expectedFill(dictionary, 'BLD', 'basisWeight', 'RD', undefined)).toBeNull();
      expect(expectedFill(dictionary, 'BLD', 'basisWeight', 'RD', 'XXX')).toBeNull();
    });

    it('still answers for slots that depend on neither', () => {
      expect(expectedFill(dictionary, 'BLD', 'height', undefined, undefined)).toEqual({ fill: 'any' });
      expect(expectedFill(dictionary, 'BLD', 'gusset', 'XX', 'XXX')).toEqual({ fill: 'does-not-apply' });
    });
  });
});
