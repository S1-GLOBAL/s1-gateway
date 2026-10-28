import { describe, expect, it } from 'vitest';
import type { DictionarySlotKey } from '../domain/slots.js';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { applyProposal } from '../domain/suggestions/apply-proposal.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { DecodeSpecId } from './decode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';

const ILLUSTRATIVE = 'A1B4D1E1F1-H90N33';
const ILLUSTRATIVE_DOTTED = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

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
      part: 'A1',
      state: 'value',
      meaning: 'Bowl lid',
    });
  });

  it('reads a dotted code given out before as the same Spec ID', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE_DOTTED });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.slots.map((slot) => slot.raw).join('.')).toBe(ILLUSTRATIVE_DOTTED);
  });

  it('reports every problem with a dotted code', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE_DOTTED.replace('.APS.', '.QQQ.') });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.issues).toEqual({ material: ['Material: QQQ is not in the dictionary.'] });
  });

  it('answers what is wrong with each part of a code written today', async () => {
    const result = await decode.execute({ code: 'A1B99D1' });

    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.issues).toEqual({ code: ['B99: This key/part is unknown.'] });
  });

  it('answers why a code written today is refused when no one part is wrong', async () => {
    const result = await decode.execute({ code: 'B4D1' });

    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.issues).toEqual({ code: ['Product type (A) is missing. Every code includes it, for example A1.'] });
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
    expect(result.value.code).toBe('A2B1D1E1F3-H90N21');
    expect(result.value.slots[0]).toMatchObject({ raw: 'CLQ', part: 'A2', meaning: 'Cup lid' });
  });

  it("decodes a code written before its unit was renamed, and labels the capacity as the unit's own", async () => {
    const result = await decoding(renamed('capacity', 'Z', 'O')).execute({ code: 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X' });
    if (!result.ok) throw result.error;
    expect(result.value.code).toBe('A3B25-G114');
    expect(result.value.slots.find((slot) => slot.key === 'capacity')).toMatchObject({ raw: 'O0014', part: 'G114', meaning: '14 oz' });
  });

  it("labels a unit as its own after it took another unit's letters and was renamed again", async () => {
    const withoutMl = applyProposal(s2Dictionary(), { slot: 'capacity', code: 'M' }, { kind: 'delete', replacement: null }, STAMP);
    const ozAsM = applyProposal(withoutMl, { slot: 'capacity', code: 'Z' }, { kind: 'edit', newCode: 'M', meaning: null, searchWords: null }, { ...STAMP, number: 2 });
    const ozAsQ = applyProposal(ozAsM, { slot: 'capacity', code: 'M' }, { kind: 'edit', newCode: 'Q', meaning: null, searchWords: null }, { ...STAMP, number: 3 });
    const result = await decoding(ozAsQ).execute({ code: 'BWL.CBG.Y.Y.Y.X.Q0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X' });
    if (!result.ok) throw result.error;
    expect(result.value.slots.find((slot) => slot.key === 'capacity')?.meaning).toBe('14 oz');
  });
});
