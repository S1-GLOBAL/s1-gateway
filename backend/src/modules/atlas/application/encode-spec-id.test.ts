import { describe, expect, it } from 'vitest';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { EncodeSpecId } from './encode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { COLOUR_CLARITY, MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE } from '../domain/options.js';

const ILLUSTRATIVE = 'A1B4D1E1F1-H90N33';
/** Its slots as they are held: each option by its number (ADR 0033). */
const ILLUSTRATIVE_SLOTS = '1.4.Y.1.1.1.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const FACTS = {
  productType: PRODUCT_TYPE.bowlLid,
  material: MATERIAL.ps,
  colourClarity: COLOUR_CLARITY.clear,
  shape: SHAPE.round,
  profile: PROFILE.dome,
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};

describe('EncodeSpecId', () => {
  const encode = new EncodeSpecId(new InMemoryDictionaryRepository());

  it('builds the code from the facts and reads it back, saving nothing', async () => {
    const result = await encode.execute({ facts: FACTS });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.dictionaryRelease).toBe('S2 0.1.0');
    expect(result.value.slots.map((slot) => slot.raw).join('.')).toBe(ILLUSTRATIVE_SLOTS);
    expect(result.value.slots.map((slot) => slot.part).join('')).toBe(ILLUSTRATIVE.replace('-', ''));
    expect(result.value.slots.find((slot) => slot.key === 'unitWeight')?.meaning).toBe('3.3 g');
  });

  it('reports every problem with the facts', async () => {
    const result = await encode.execute({ facts: { ...FACTS, height: { value: '12000', unit: 'mm' } } });

    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.issues).toEqual({ height: ['Height: 12000 mm is outside 1–9999 mm.'] });
  });

  it('fails loudly when the current release is missing', async () => {
    await expect(new EncodeSpecId({ get: async () => null }).execute({ facts: FACTS })).rejects.toThrow(
      'Dictionary S2 0.1.0 is missing',
    );
  });
});
