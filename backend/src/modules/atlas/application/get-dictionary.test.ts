import { describe, expect, it } from 'vitest';
import { GetDictionary } from './get-dictionary.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

describe('GetDictionary', () => {
  it('hands out release S1 0.1.0: each dictionary slot with its values, and every rule', async () => {
    const dictionary = await new GetDictionary(new InMemoryDictionaryRepository()).execute();

    expect(dictionary.release).toBe('S1 0.1.0');
    expect(dictionary.approvedOn).toBe('2026-10-16');
    expect(dictionary.slots.map((slot) => `${slot.key}/${slot.name}`)).toEqual([
      'productType/Product type',
      'material/Material',
      'coating/Coating',
      'colourClarity/Colour / clarity',
      'shape/Shape',
      'profile/Profile',
      'capacity/Nominal capacity',
    ]);
    expect(dictionary.slots.flatMap((slot) => slot.values)).toHaveLength(28);
    expect(dictionary.slots[0]?.values).toEqual([
      { code: 'BLD', meaning: 'Bowl lid' },
      { code: 'BWL', meaning: 'Bowl' },
      { code: 'CLD', meaning: 'Cup lid' },
      { code: 'SUP', meaning: 'Stand-up pouch' },
    ]);
  });

  it('orders the rules by product type, then slot', async () => {
    const { rules } = await new GetDictionary(new InMemoryDictionaryRepository()).execute();

    expect(rules).toHaveLength(56);
    expect(rules[0]).toEqual({ productType: 'BLD', slot: 'coating', rule: 'applies' });
    expect(rules[13]).toEqual({ productType: 'BLD', slot: 'thickness', rule: 'applies' });
    expect(rules[14]).toEqual({ productType: 'BWL', slot: 'coating', rule: 'applies' });
    expect(rules.at(-1)).toEqual({ productType: 'SUP', slot: 'thickness', rule: 'applies' });
  });

  it('fails loudly when the current release is missing', async () => {
    await expect(new GetDictionary({ get: async () => null }).execute()).rejects.toThrow(
      'Dictionary S1 0.1.0 is missing',
    );
  });
});
