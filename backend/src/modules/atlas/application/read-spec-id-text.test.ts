import { describe, expect, it } from 'vitest';
import { ReadSpecIdText } from './read-spec-id-text.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const readText = new ReadSpecIdText(new InMemoryDictionaryRepository());

describe('ReadSpecIdText', () => {
  it('reads the facts and builds their code', async () => {
    const result = await readText.execute({ text: '  14oz Bagasse Bowl for Cava ' });
    if (!result.ok) throw result.error;

    expect(result.value.decoded?.code).toBe('BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X');
    expect(result.value.read).toEqual([
      { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'Bowl', ruling: null },
      { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
      { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
    ]);
    expect(result.value.ignored).toEqual(['for', 'Cava']);
  });

  it('drops a fact the product type cannot have, lists its words as ignored, and still builds the code', async () => {
    const result = await readText.execute({ text: '14oz bowl lid PP' });
    if (!result.ok) throw result.error;

    expect(result.value.read.map((fact) => fact.key)).toEqual(['productType', 'material']);
    expect(result.value.ignored).toEqual(['14oz']);
    expect(result.value.decoded?.code.startsWith('BLD.APP.')).toBe(true);
  });

  it('answers no code until there is a product type, with each fact in plain words', async () => {
    const result = await readText.execute({ text: 'clear PET 12oz' });
    if (!result.ok) throw result.error;

    expect(result.value.decoded).toBeNull();
    expect(result.value.read.map((fact) => fact.meaning)).toEqual(['Polymer, PET', 'Clear', '12 oz']);
  });

  it('builds the code with a product type given for text that names none', async () => {
    const result = await readText.execute({ text: 'clear PET 12oz', productType: 'CUP' });
    if (!result.ok) throw result.error;
    expect(result.value.decoded?.code.startsWith('CUP.APT.Y.CL.')).toBe(true);
  });

  it('reads 500 characters, and refuses 501 and empty text', async () => {
    const at = await readText.execute({ text: `bowl ${'x'.repeat(495)}` });
    expect(at.ok).toBe(true);

    const over = await readText.execute({ text: 'x'.repeat(501) });
    expect(!over.ok && over.error.code).toBe('VALIDATION_FAILED');
    expect(!over.ok && over.error.details).toEqual({ fields: { text: ['Search text must be at most 500 characters.'] } });

    const empty = await readText.execute({ text: '   ' });
    expect(!empty.ok && empty.error.details).toEqual({ fields: { text: ['Type some text to read.'] } });
  });

  it('refuses a product type not in the dictionary, beside it', async () => {
    const result = await readText.execute({ text: 'clear PET', productType: 'ZZZ' });
    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(!result.ok && result.error.details).toEqual({ fields: { productType: ['Product type: ZZZ is not in the dictionary.'] } });
  });
});
