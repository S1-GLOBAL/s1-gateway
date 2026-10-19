import { describe, expect, it } from 'vitest';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { EncodeSpecId } from './encode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const ILLUSTRATIVE = 'S2.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX.00.XX.X.XX.XX.XX.XX.XX';
const FACTS = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
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
    expect(result.value.slots.map((slot) => slot.raw).join('.')).toBe(ILLUSTRATIVE);
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
