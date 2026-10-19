import { describe, expect, it } from 'vitest';
import { GetDictionary } from './get-dictionary.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

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
    expect(dictionary.slots.flatMap((slot) => slot.values)).toHaveLength(118);
    expect(dictionary.slots[0]?.values.slice(0, 3)).toEqual([
      { code: 'BAG', meaning: 'Bag' },
      { code: 'BLD', meaning: 'Bowl lid' },
      { code: 'BWL', meaning: 'Bowl' },
    ]);
  });

  it('orders the rules by product type, then slot', async () => {
    const { rules } = await new GetDictionary(new InMemoryDictionaryRepository()).execute();

    expect(rules).toHaveLength(682);
    expect(rules[0]).toEqual({ productType: 'BAG', slot: 'coating', rule: 'applies' });
    expect(rules[21]).toEqual({ productType: 'BAG', slot: 'window', rule: 'applies' });
    expect(rules[22]).toEqual({ productType: 'BLD', slot: 'coating', rule: 'applies' });
    expect(rules.at(-1)).toEqual({ productType: 'WRP', slot: 'window', rule: 'never' });
  });

  it('fails loudly when the current release is missing', async () => {
    await expect(new GetDictionary({ get: async () => null }).execute()).rejects.toThrow(
      'Dictionary S2 0.1.0 is missing',
    );
  });
});
