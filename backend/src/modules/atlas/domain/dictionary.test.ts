import { describe, expect, it } from 'vitest';
import { s1Dictionary } from './testing/s1-dictionary.js';

describe('Dictionary', () => {
  const dictionary = s1Dictionary();

  it('holds release S1 0.1.0 with 28 values and 56 rules', () => {
    expect(dictionary.release).toBe('S1 0.1.0');
    expect(dictionary.values()).toHaveLength(28);
    expect(dictionary.slotRules()).toHaveLength(56);
  });

  it('knows each meaning, and nothing else', () => {
    expect(dictionary.meaningOf('productType', 'BLD')).toBe('Bowl lid');
    expect(dictionary.meaningOf('capacity', 'Z')).toBe('Ounces, nominal trade size');
    expect(dictionary.meaningOf('productType', 'ZZZ')).toBeUndefined();
    expect(dictionary.meaningOf('coating', 'BLD')).toBeUndefined();
  });

  it('orders values by code within each slot, slots in code order', () => {
    expect(dictionary.valuesOf('productType').map((value) => value.code)).toEqual(['BLD', 'BWL', 'CLD', 'SUP']);
    expect(dictionary.values()[0]?.slot).toBe('productType');
    expect(dictionary.values().at(-1)?.slot).toBe('capacity');
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
