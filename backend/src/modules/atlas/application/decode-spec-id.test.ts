import { describe, expect, it } from 'vitest';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { DecodeSpecId } from './decode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

describe('DecodeSpecId', () => {
  const decode = new DecodeSpecId(new InMemoryDictionaryRepository());

  it('reads a code slot by slot, under the current release', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.dictionaryRelease).toBe('S1 0.1.0');
    expect(result.value.slots).toHaveLength(18);
    expect(result.value.slots[1]).toEqual({
      number: 2,
      key: 'productType',
      name: 'Product type',
      raw: 'BLD',
      state: 'value',
      meaning: 'Bowl lid',
    });
  });

  it('reports every problem with the code', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE.replace('.APS.', '.QQQ.') });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.issues).toEqual({ material: ['Material: QQQ is not in the dictionary.'] });
  });

  it('fails loudly when the current release is missing', async () => {
    await expect(new DecodeSpecId({ get: async () => null }).execute({ code: ILLUSTRATIVE })).rejects.toThrow(
      'Dictionary S1 0.1.0 is missing',
    );
  });
});
