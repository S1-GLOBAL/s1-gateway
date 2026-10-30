import { describe, expect, it } from 'vitest';
import { expectedFill, type ExpectedFill } from './applicability.js';
import { RULED_SLOTS } from './slots.js';
import { s2Dictionary } from './testing/s2-dictionary.js';
import { MATERIAL, PRODUCT_TYPE, SHAPE } from './options.js';

const dictionary = s2Dictionary();

/** `A` any, `X` doesn't apply, `0` not known: one letter per ruled slot, in slot order. */
function fills(productType: string, shape: string, material: string): string {
  return RULED_SLOTS.map((key) => {
    const expected = expectedFill(dictionary, productType, key, shape, material);
    if (!expected) return '-';
    return { any: 'A', 'does-not-apply': 'X', 'not-known': 'Y' }[expected.fill];
  }).join(' ');
}

describe('expectedFill', () => {
  describe('follows each row of the table', () => {
    it.each<[string, string, Parameters<typeof expectedFill>[2], string, string, ExpectedFill | null]>([
      ['applies', PRODUCT_TYPE.bowlLid, 'height', SHAPE.square, MATERIAL.ps, { fill: 'any' }],
      ['never', PRODUCT_TYPE.bowlLid, 'capacity', SHAPE.round, MATERIAL.ps, { fill: 'does-not-apply' }],
      ['round_only, shape not known', PRODUCT_TYPE.bowlLid, 'topDiameter', 'Y', MATERIAL.ps, { fill: 'not-known', dependsOn: 'shape' }],
      ['round_only, round', PRODUCT_TYPE.bowlLid, 'topDiameter', SHAPE.round, MATERIAL.ps, { fill: 'any' }],
      ['round_only, not round', PRODUCT_TYPE.bowlLid, 'topDiameter', SHAPE.oval, MATERIAL.ps, { fill: 'does-not-apply' }],
      ['non_round_only, shape not known', PRODUCT_TYPE.bowl, 'length', 'Y', MATERIAL.ps, { fill: 'not-known', dependsOn: 'shape' }],
      ['non_round_only, round', PRODUCT_TYPE.bowl, 'length', SHAPE.round, MATERIAL.ps, { fill: 'does-not-apply' }],
      ['non_round_only, not round', PRODUCT_TYPE.bowl, 'width', SHAPE.rectangular, MATERIAL.ps, { fill: 'any' }],
      ['paper_only, material not known', PRODUCT_TYPE.cupLid, 'basisWeight', SHAPE.round, 'Y', { fill: 'not-known', dependsOn: 'material' }],
      ['paper_only, paper', PRODUCT_TYPE.cupLid, 'basisWeight', SHAPE.round, MATERIAL.paper, { fill: 'any' }],
      ['paper_only, not paper', PRODUCT_TYPE.cupLid, 'basisWeight', SHAPE.round, MATERIAL.pet, { fill: 'does-not-apply' }],
    ])('%s', (_row, productType, key, shape, material, expected) => {
      expect(expectedFill(dictionary, productType, key, shape, material)).toEqual(expected);
    });
  });

  describe('for each product type', () => {
    //                          coating colour shape profile capacity top bottom height length width gusset unit basis thick
    //                          wall print compartments plies lid-opening handle wrap window
    it.each([
      [PRODUCT_TYPE.bowlLid, SHAPE.round, MATERIAL.ps, 'A A A A X A X A X X X A X A X A X X X X X X'],
      [PRODUCT_TYPE.bowlLid, SHAPE.square, MATERIAL.kraft, 'A A A A X X X A A A X A A A X A X X X X X X'],
      [PRODUCT_TYPE.bowlLid, 'Y', 'Y', 'A A A A X Y X A Y Y X A Y A X A X X X X X X'],
      [PRODUCT_TYPE.cupLid, SHAPE.round, MATERIAL.ps, 'A A A A X A X A X X X A X A X A X X A X X X'],
      [PRODUCT_TYPE.cupLid, SHAPE.oval, MATERIAL.paper, 'A A A A X X X A A A X A A A X A X X A X X X'],
      [PRODUCT_TYPE.cupLid, 'Y', 'Y', 'A A A A X Y X A Y Y X A Y A X A X X A X X X'],
      [PRODUCT_TYPE.bowl, SHAPE.round, MATERIAL.pet, 'A A A X A A A A X X X A X A A A A X X X X X'],
      [PRODUCT_TYPE.bowl, SHAPE.rectangular, MATERIAL.kraft, 'A A A X A X X A A A X A A A A A A X X X X X'],
      [PRODUCT_TYPE.bowl, 'Y', 'Y', 'A A A X A Y Y A Y Y X A Y A A A A X X X X X'],
      [PRODUCT_TYPE.standUpPouch, 'X', MATERIAL.ps, 'A A X X A X X A X A A A A A X A X X X X X A'],
      [PRODUCT_TYPE.standUpPouch, 'X', MATERIAL.kraft, 'A A X X A X X A X A A A A A X A X X X X X A'],
      [PRODUCT_TYPE.standUpPouch, 'X', 'Y', 'A A X X A X X A X A A A A A X A X X X X X A'],
    ])('%s with shape %s and material %s', (productType, shape, material, expected) => {
      expect(fills(productType, shape, material)).toBe(expected);
    });

    it('fills basis weight on a stand-up pouch whatever the material', () => {
      for (const material of [MATERIAL.ps, MATERIAL.pet, MATERIAL.paper, MATERIAL.kraft, 'Y']) {
        expect(expectedFill(dictionary, PRODUCT_TYPE.standUpPouch, 'basisWeight', 'X', material)).toEqual({ fill: 'any' });
      }
    });
  });

  describe('skips a slot whose shape or material has its own problem', () => {
    it('skips shape-dependent slots when the shape failed a check or is X', () => {
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'topDiameter', undefined, MATERIAL.ps)).toBeNull();
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'length', 'X', MATERIAL.ps)).toBeNull();
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowl, 'bottomDiameter', undefined, MATERIAL.ps)).toBeNull();
    });

    it('skips material-dependent slots when the material failed a check or is X', () => {
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'basisWeight', SHAPE.round, undefined)).toBeNull();
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'basisWeight', SHAPE.round, 'X')).toBeNull();
    });

    it('still answers for slots that depend on neither', () => {
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'height', undefined, undefined)).toEqual({ fill: 'any' });
      expect(expectedFill(dictionary, PRODUCT_TYPE.bowlLid, 'gusset', 'X', 'X')).toEqual({ fill: 'does-not-apply' });
    });
  });
});
