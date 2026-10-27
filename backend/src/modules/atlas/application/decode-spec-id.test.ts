import { describe, expect, it } from 'vitest';
import type { DictionarySlotKey } from '../domain/slots.js';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { applyProposal } from '../domain/suggestions/apply-proposal.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { DecodeSpecId } from './decode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

describe('DecodeSpecId', () => {
  const decode = new DecodeSpecId(new InMemoryDictionaryRepository());

  it('reads a code slot by slot, under the current release', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.dictionaryRelease).toBe('S2 0.1.0');
    expect(result.value.slots).toHaveLength(25);
    expect(result.value.slots[0]).toEqual({
      number: 1,
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
      'Dictionary S2 0.1.0 is missing',
    );
  });
});

describe('DecodeSpecId after approved changes (ADR 0031)', () => {
  const STAMP = { number: 1, at: new Date('2026-10-27T10:00:00.000Z') };
  const renamed = (slot: DictionarySlotKey, code: string, newCode: string) =>
    applyProposal(s2Dictionary(), { slot, code }, { kind: 'edit', newCode, meaning: null, searchWords: null }, STAMP);
  const decoding = (dictionary: ReturnType<typeof s2Dictionary>) => {
    const dictionaries = new InMemoryDictionaryRepository();
    dictionaries.replace(dictionary);
    return new DecodeSpecId(dictionaries);
  };

  it('decodes an S1 code whose product type was renamed, in the live letters', async () => {
    const result = await decoding(renamed('productType', 'CLD', 'CLQ')).execute({
      code: 'S1.CLD.APT.00.CL.RD.FL.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0021.XXX.000.XX',
    });
    if (!result.ok) throw result.error;
    expect(result.value.code.startsWith('CLQ.APT.')).toBe(true);
    expect(result.value.slots[0]).toMatchObject({ raw: 'CLQ', meaning: 'Cup lid' });
  });

  it("decodes a code written before its unit was renamed, and labels the capacity as the unit's own", async () => {
    const result = await decoding(renamed('capacity', 'Z', 'O')).execute({ code: 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X' });
    if (!result.ok) throw result.error;
    expect(result.value.code).toBe('BWL.CBG.Y.Y.Y.X.O0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X');
    expect(result.value.slots.find((slot) => slot.key === 'capacity')?.meaning).toBe('14 oz');
  });
});
