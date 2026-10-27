import { describe, expect, it } from 'vitest';
import { Dictionary } from './dictionary.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

describe('Dictionary', () => {
  const dictionary = s2Dictionary();

  it('holds release S2 0.1.0 with 118 values and 682 rules', () => {
    expect(dictionary.release).toBe('S2 0.1.0');
    expect(dictionary.values()).toHaveLength(118);
    expect(dictionary.slotRules()).toHaveLength(682);
  });

  it('knows each meaning, and nothing else', () => {
    expect(dictionary.meaningOf('productType', 'BLD')).toBe('Bowl lid');
    expect(dictionary.meaningOf('capacity', 'Z')).toBe('Ounces, nominal trade size');
    expect(dictionary.meaningOf('productType', 'ZZZ')).toBeUndefined();
    expect(dictionary.meaningOf('coating', 'BLD')).toBeUndefined();
  });

  it('orders values by code within each slot, slots in code order', () => {
    expect(dictionary.valuesOf('productType').map((value) => value.code).slice(0, 4)).toEqual(['BAG', 'BLD', 'BWL', 'CCR']);
    expect(dictionary.valuesOf('productType')).toHaveLength(31);
    expect(dictionary.values()[0]?.slot).toBe('productType');
    expect(dictionary.values().at(-1)?.slot).toBe('window');
  });

  it('answers the rule for a slot of a product type', () => {
    expect(dictionary.ruleFor('BLD', 'capacity')).toBe('never');
    expect(dictionary.ruleFor('BWL', 'bottomDiameter')).toBe('round_only');
    expect(dictionary.ruleFor('SUP', 'basisWeight')).toBe('applies');
  });

  it('refuses to guess a missing rule', () => {
    expect(() => dictionary.ruleFor('ZZZ', 'height')).toThrow();
  });
});

describe('Dictionary after approved changes', () => {
  const seed = s2Dictionary();
  const changed = new Dictionary(
    seed.release,
    seed.approvedOn,
    [...seed.values().filter((value) => value.code !== 'APS' && value.code !== 'HD'), { slot: 'material', code: 'APZ', meaning: 'Polymer, PS' }],
    seed.slotRules(),
    {
      renames: [
        { slot: 'material', oldCode: 'APS', newCode: 'APZ', changeNumber: 1 },
        { slot: 'profile', oldCode: 'HD', newCode: null, changeNumber: 2 },
      ],
      searchWords: [
        { slot: 'material', word: 'styrene', code: 'APZ', changeNumber: 1 },
        { slot: 'material', word: 'polystyrene', code: 'APZ', changeNumber: 1 },
      ],
      change: { number: 2, at: new Date('2026-10-27T10:00:00.000Z') },
    },
  );

  it('reads a renamed code as its live letters, a deleted one as gone, and any other as itself', () => {
    expect(changed.live('material', 'APS')).toBe('APZ');
    expect(changed.live('profile', 'HD')).toBeUndefined();
    expect(changed.live('material', 'APP')).toBe('APP');
    expect(changed.live('material', 'AQQ')).toBe('AQQ');
  });

  it("knows its latest change, and an option's search words in order", () => {
    expect(changed.change?.number).toBe(2);
    expect(changed.searchWordsOf('material', 'APZ')).toEqual(['polystyrene', 'styrene']);
    expect(seed.change).toBeNull();
    expect(seed.live('material', 'APS')).toBe('APS');
  });
});
