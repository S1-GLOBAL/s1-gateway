import { describe, expect, it } from 'vitest';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { applyProposal } from '../domain/suggestions/apply-proposal.js';
import { ReadSpecIdText } from './read-spec-id-text.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const readText = new ReadSpecIdText(new InMemoryDictionaryRepository());

describe('ReadSpecIdText', () => {
  it('reads the facts and builds their code', async () => {
    const result = await readText.execute({ text: '  14oz Bagasse Bowl for Cava ' });
    if (!result.ok) throw result.error;

    expect(result.value.decoded?.code).toBe('A3B25-G114');
    expect(result.value.read).toEqual([
      { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'Bowl', ruling: null },
      { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
      { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
    ]);
    expect(result.value.ignored).toEqual(['for', 'Cava']);
    expect(result.value.notes).toEqual([]);
  });

  it('keeps a tray\'s length and width by reading the shape as rectangular', async () => {
    const result = await readText.execute({ text: 'tray 200 x 150 x 60' });
    if (!result.ok) throw result.error;

    const meaning = Object.fromEntries(result.value.decoded?.slots.map((slot) => [slot.key, slot.meaning]) ?? []);
    expect(meaning.shape).toBe('Rectangular');
    expect(meaning.length).toBe('200 mm');
    expect(meaning.width).toBe('150 mm');
    expect(meaning.height).toBe('60 mm');
    expect(result.value.ignored).toEqual([]);
  });

  it('keeps a square tray square, and still reads its length and width', async () => {
    const result = await readText.execute({ text: 'square tray 200 x 150 x 60' });
    if (!result.ok) throw result.error;

    const meaning = Object.fromEntries(result.value.decoded?.slots.map((slot) => [slot.key, slot.meaning]) ?? []);
    expect(meaning.shape).toBe('Square');
    expect(meaning.length).toBe('200 mm');
    expect(meaning.width).toBe('150 mm');
    expect(meaning.height).toBe('60 mm');
  });

  it('drops a fact the product type cannot have, says why in a note, and still builds the code', async () => {
    const result = await readText.execute({ text: '14oz bowl lid PP' });
    if (!result.ok) throw result.error;

    expect(result.value.read.map((fact) => fact.key)).toEqual(['productType', 'material']);
    expect(result.value.ignored).toEqual([]);
    expect(result.value.notes).toEqual([
      'The product is the lid. It goes on a 14 oz bowl. It is a Bowl lid (A1).',
      'Nominal capacity does not apply to a bowl lid.',
    ]);
    expect(result.value.decoded?.code).toBe('A1B3');
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
    expect(result.value.decoded?.code).toBe('A5B1D1-G112');
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

describe('ReadSpecIdText after an approved change (ADR 0031)', () => {
  it('reads an approved search word from the next request, and not before', async () => {
    const dictionaries = new InMemoryDictionaryRepository();
    const reading = new ReadSpecIdText(dictionaries);
    const material = async () => {
      const result = await reading.execute({ text: 'sugarcane fibre bowl' });
      if (!result.ok) throw result.error;
      return result.value.read.find((fact) => fact.key === 'material')?.meaning;
    };

    expect(await material()).toBeUndefined();
    const live = await dictionaries.get(CURRENT_RELEASE);
    if (!live) throw new Error('No dictionary');
    dictionaries.replace(
      applyProposal(live, { slot: 'material', code: 'CBG' }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['sugarcane fibre'] }, {
        number: 1,
        at: new Date('2026-10-27T10:00:00.000Z'),
      }),
    );
    expect(await material()).toBe('Molded fibre, bagasse');
  });
});
