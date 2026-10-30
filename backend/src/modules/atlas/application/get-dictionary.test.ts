import { describe, expect, it } from 'vitest';
import { applyProposal } from '../domain/suggestions/apply-proposal.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { GetDictionary } from './get-dictionary.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';

describe('GetDictionary', () => {
  it('hands out release S2 0.1.0: each dictionary slot with its values, and every rule', async () => {
    const dictionary = await new GetDictionary(new InMemoryDictionaryRepository()).execute();

    expect(dictionary.release).toBe('S2 0.1.0');
    expect(dictionary.approvedOn).toBe('2026-10-19');
    expect(dictionary.slots.map((slot) => `${slot.key}/${slot.name}`)).toEqual([
      'productType/Product type',
      'material/Material',
      'coating/Coating',
      'colourClarity/Colour / clarity',
      'shape/Shape',
      'profile/Profile',
      'capacity/Nominal capacity',
      'wall/Wall',
      'print/Print',
      'lidOpening/Lid opening',
      'handle/Handle',
      'wrap/Individual wrap',
      'window/Window',
    ]);
    expect(dictionary.slots.flatMap((slot) => slot.values)).toHaveLength(129);
    expect(dictionary.slots[0]?.values.slice(0, 3)).toEqual([
      { code: PRODUCT_TYPE.bowlLid, meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] },
      { code: PRODUCT_TYPE.cupLid, meaning: 'Cup lid', number: 2, broader: null, searchWords: [] },
      { code: PRODUCT_TYPE.bowl, meaning: 'Bowl', number: 3, broader: null, searchWords: [] },
    ]);
    const materials = dictionary.slots.find((slot) => slot.key === 'material')?.values ?? [];
    expect(materials.find((value) => value.code === MATERIAL.recycledKraft)?.broader).toBe(MATERIAL.kraft);
  });

  it("hands out each option's approved search words", async () => {
    const dictionaries = new InMemoryDictionaryRepository();
    dictionaries.replace(
      applyProposal(
        s2Dictionary(),
        { slot: 'material', code: MATERIAL.bagasse },
        { kind: 'edit', newCode: null, meaning: null, searchWords: ['sugarcane fibre', 'cane pulp'] },
        { number: 1, at: new Date('2026-10-29T08:00:00.000Z') },
      ),
    );

    const { slots } = await new GetDictionary(dictionaries).execute();

    const materials = slots.find((slot) => slot.key === 'material')?.values ?? [];
    expect(materials.find((value) => value.code === MATERIAL.bagasse)?.searchWords).toEqual(['cane pulp', 'sugarcane fibre']);
    expect(materials.find((value) => value.code === MATERIAL.ps)?.searchWords).toEqual([]);
  });

  it("orders the rules by product type's number, then slot", async () => {
    const { rules } = await new GetDictionary(new InMemoryDictionaryRepository()).execute();

    expect(rules).toHaveLength(792);
    expect(rules[0]).toEqual({ productType: PRODUCT_TYPE.bowlLid, slot: 'coating', rule: 'applies' });
    expect(rules[21]).toEqual({ productType: PRODUCT_TYPE.bowlLid, slot: 'window', rule: 'never' });
    expect(rules[22]).toEqual({ productType: PRODUCT_TYPE.cupLid, slot: 'coating', rule: 'applies' });
    expect(rules.at(-1)).toEqual({ productType: PRODUCT_TYPE.cupSleeve, slot: 'window', rule: 'never' });
  });

  it('fails loudly when the current release is missing', async () => {
    await expect(new GetDictionary({ get: async () => null }).execute()).rejects.toThrow(
      'Dictionary S2 0.1.0 is missing',
    );
  });
});
