import { describe, expect, it } from 'vitest';
import { Dictionary } from './dictionary.js';
import { s2Dictionary } from './testing/s2-dictionary.js';
import { CAPACITY_UNIT, COATING, MATERIAL, PRODUCT_TYPE, PROFILE } from './options.js';

describe('Dictionary', () => {
  const dictionary = s2Dictionary();

  it('holds release S2 0.1.0 with 129 values and 792 rules: the seed, the vessels sold with their lids, then the glove and cup sleeve options', () => {
    expect(dictionary.release).toBe('S2 0.1.0');
    expect(dictionary.values()).toHaveLength(129);
    expect(dictionary.slotRules()).toHaveLength(792);
  });

  it('knows each meaning by its number, and nothing else', () => {
    expect(dictionary.meaningOf('productType', PRODUCT_TYPE.bowlLid)).toBe('Bowl lid');
    expect(dictionary.meaningOf('capacity', CAPACITY_UNIT.ounces)).toBe('Ounces, nominal trade size');
    expect(dictionary.meaningOf('productType', PRODUCT_TYPE.glove)).toBe('Glove');
    expect(dictionary.meaningOf('productType', '999')).toBeUndefined();
    // The letters an option had are no key (ADR 0033).
    expect(dictionary.meaningOf('productType', 'BLD')).toBeUndefined();
  });

  it('orders values by number within each slot, slots in code order', () => {
    expect(dictionary.valuesOf('productType').map((value) => value.code).slice(0, 4)).toEqual(['1', '2', '3', '4']);
    expect(dictionary.valuesOf('productType').map((value) => value.number).slice(-3)).toEqual([34, 35, 36]);
    expect(dictionary.valuesOf('productType')).toHaveLength(36);
    expect(dictionary.values()[0]?.slot).toBe('productType');
    expect(dictionary.values().at(-1)?.slot).toBe('window');
  });

  it('answers the rule for a slot of a product type', () => {
    expect(dictionary.ruleFor(PRODUCT_TYPE.bowlLid, 'capacity')).toBe('never');
    expect(dictionary.ruleFor(PRODUCT_TYPE.bowl, 'bottomDiameter')).toBe('round_only');
    expect(dictionary.ruleFor(PRODUCT_TYPE.standUpPouch, 'basisWeight')).toBe('applies');
    expect(dictionary.ruleFor(PRODUCT_TYPE.cupSleeve, 'basisWeight')).toBe('paper_only');
  });

  it('refuses to guess a missing rule', () => {
    expect(() => dictionary.ruleFor('999', 'height')).toThrow();
  });

  it('knows each material a grade of another: through every broader material, never the other way', () => {
    expect(dictionary.broaderOf(MATERIAL.recycledKraft)).toBe(MATERIAL.kraft);
    expect(dictionary.isGradeOf(MATERIAL.recycledKraft, MATERIAL.kraft)).toBe(true);
    expect(dictionary.isGradeOf(MATERIAL.recycledKraft, MATERIAL.paper)).toBe(true);
    expect(dictionary.isGradeOf(MATERIAL.paper, MATERIAL.paper)).toBe(true);
    expect(dictionary.isGradeOf(MATERIAL.paper, MATERIAL.kraft)).toBe(false);
    expect(dictionary.isGradeOf(MATERIAL.pet, MATERIAL.paper)).toBe(false);
    expect(dictionary.isGradeOf(MATERIAL.vinyl, MATERIAL.polymer)).toBe(true);
    expect(dictionary.broaderOf(MATERIAL.birch)).toBeUndefined();
  });

  it('reads the letters each option had, for a dotted code given out before (ADR 0033)', () => {
    expect(dictionary.fromLetters('productType', 'BLD')).toBe(PRODUCT_TYPE.bowlLid);
    expect(dictionary.fromLetters('material', 'BKC')).toBe(MATERIAL.recycledKraft);
    expect(dictionary.fromLetters('capacity', 'Z')).toBe(CAPACITY_UNIT.ounces);
    expect(dictionary.capacityFromLetters('Z0012')).toBe('10012');
    expect(dictionary.fromLetters('material', 'QQQ')).toBeUndefined();
    // An option added since has no letters.
    expect(dictionary.fromLetters('productType', 'GLV')).toBeUndefined();
  });
});

describe('Dictionary after approved changes', () => {
  const seed = s2Dictionary();
  // Polystyrene renamed APS → APZ before options were known by number, so 0021 kept APZ as its letters; half dome deleted.
  const changed = new Dictionary(
    seed.release,
    seed.approvedOn,
    seed
      .values()
      .filter((value) => !(value.slot === 'profile' && value.code === PROFILE.halfDome))
      .map((value) => (value.slot === 'material' && value.code === MATERIAL.ps ? { ...value, legacyCode: 'APZ' } : value)),
    seed.slotRules(),
    {
      renames: [
        { slot: 'material', oldCode: 'APS', newCode: 'APZ', changeNumber: 1 },
        { slot: 'profile', oldCode: 'HD', newCode: null, changeNumber: 2 },
      ],
      retired: [{ slot: 'profile', number: 2, code: PROFILE.halfDome, legacyCode: 'HD', meaning: 'Half dome', changeNumber: 2 }],
      searchWords: [
        { slot: 'material', word: 'styrene', code: MATERIAL.ps, changeNumber: 1 },
        { slot: 'material', word: 'polystyrene', code: MATERIAL.ps, changeNumber: 1 },
      ],
      change: { number: 2, at: new Date('2026-10-27T10:00:00.000Z') },
    },
  );

  it('reads a live option as itself and a deleted one as gone', () => {
    expect(changed.live('material', MATERIAL.ps)).toBe(MATERIAL.ps);
    expect(changed.live('profile', PROFILE.halfDome)).toBeUndefined();
    expect(changed.live('material', '999')).toBeUndefined();
    expect(changed.liveCapacity('10012')).toBe('10012');
  });

  it('reads letters through a rename, and a deleted option by the letters it had', () => {
    expect(changed.fromLetters('material', 'APS')).toBe(MATERIAL.ps);
    expect(changed.fromLetters('material', 'APZ')).toBe(MATERIAL.ps);
    expect(changed.fromLetters('profile', 'HD')).toBe(PROFILE.halfDome);
    expect(changed.retiredNumbered('profile', 2)?.meaning).toBe('Half dome');
  });

  it('never gives a deleted number again', () => {
    expect(changed.nextNumber('profile')).toBe(4);
    expect(changed.nextNumber('coating')).toBe(Number(COATING.powdered) + 1);
  });

  it("knows its latest change, and an option's search words in order", () => {
    expect(changed.change?.number).toBe(2);
    expect(changed.searchWordsOf('material', MATERIAL.ps)).toEqual(['polystyrene', 'styrene']);
    expect(seed.change).toBeNull();
    expect(seed.live('material', MATERIAL.ps)).toBe(MATERIAL.ps);
  });
});
