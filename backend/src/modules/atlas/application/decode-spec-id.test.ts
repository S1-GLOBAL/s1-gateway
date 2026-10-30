import { describe, expect, it } from 'vitest';
import { Dictionary, type DictionaryHistory } from '../domain/dictionary.js';
import type { DictionarySlotKey } from '../domain/slots.js';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { S2_0_1_0_RULES, S2_0_1_0_VALUES } from '../domain/testing/s2-dictionary.js';
import { DecodeSpecId } from './decode-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { CAPACITY_UNIT, PRODUCT_TYPE } from '../domain/options.js';

const ILLUSTRATIVE = 'A1B4D1E1F1-H90N33';
const ILLUSTRATIVE_DOTTED = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
/** The same slots as they are held: each option by its number (ADR 0033). */
const ILLUSTRATIVE_SLOTS = '1.4.Y.1.1.1.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

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
      raw: PRODUCT_TYPE.bowlLid,
      part: 'A1',
      state: 'value',
      meaning: 'Bowl lid',
    });
  });

  it('reads a dotted code given out before as the same Spec ID', async () => {
    const result = await decode.execute({ code: ILLUSTRATIVE_DOTTED });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.slots.map((slot) => slot.raw).join('.')).toBe(ILLUSTRATIVE_SLOTS);
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

describe('DecodeSpecId after approved changes (ADR 0031, ADR 0033)', () => {
  /**
   * S2 0.1.0 as migration 0021 leaves it after letters were changed before
   * options were known by number: each option keeps its last letters, and
   * the letters before are a rename.
   */
  const lettered = (slot: DictionarySlotKey, key: string, letters: string, history: DictionaryHistory) =>
    new Dictionary(
      'S2 0.1.0',
      '2026-10-19',
      S2_0_1_0_VALUES.map((value) => (value.slot === slot && value.code === key ? { ...value, legacyCode: letters } : value)),
      S2_0_1_0_RULES,
      history,
    );
  const decoding = (dictionary: Dictionary) => {
    const dictionaries = new InMemoryDictionaryRepository();
    dictionaries.replace(dictionary);
    return new DecodeSpecId(dictionaries);
  };

  it('decodes an S1 code in letters its product type had before a rename, as that product type', async () => {
    const dictionary = lettered('productType', PRODUCT_TYPE.cupLid, 'CLQ', {
      renames: [{ slot: 'productType', oldCode: 'CLD', newCode: 'CLQ', changeNumber: 1 }],
    });
    const result = await decoding(dictionary).execute({
      code: 'S1.CLD.APT.00.CL.RD.FL.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0021.XXX.000.XX',
    });
    if (!result.ok) throw result.error;
    expect(result.value.code).toBe('A2B1D1E1F3-H90N21');
    expect(result.value.slots[0]).toMatchObject({ raw: PRODUCT_TYPE.cupLid, part: 'A2', meaning: 'Cup lid' });
  });

  it("decodes a code written in a unit's letters before a rename, and labels the capacity as the unit's own", async () => {
    const dictionary = lettered('capacity', CAPACITY_UNIT.ounces, 'O', {
      renames: [{ slot: 'capacity', oldCode: 'Z', newCode: 'O', changeNumber: 1 }],
    });
    for (const letters of ['Z', 'O']) {
      const result = await decoding(dictionary).execute({ code: `BWL.CBG.Y.Y.Y.X.${letters}0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X` });
      if (!result.ok) throw result.error;
      expect(result.value.code).toBe('A3B25-G114');
      expect(result.value.slots.find((slot) => slot.key === 'capacity')).toMatchObject({ raw: '10014', part: 'G114', meaning: '14 oz' });
    }
  });

  it("never reads a deleted unit's letters as the unit that took them later", async () => {
    // Millilitres deleted, then ounces moved to its letters M, then on to Q.
    const dictionary = lettered('capacity', CAPACITY_UNIT.ounces, 'Q', {
      renames: [
        { slot: 'capacity', oldCode: 'M', newCode: null, changeNumber: 1 },
        { slot: 'capacity', oldCode: 'Z', newCode: 'Q', changeNumber: 3 },
      ],
      retired: [{ slot: 'capacity', number: 2, code: CAPACITY_UNIT.millilitres, legacyCode: 'M', meaning: 'Millilitres', changeNumber: 1 }],
    });
    const decode = decoding(new Dictionary(
      dictionary.release,
      dictionary.approvedOn,
      dictionary.values().filter((value) => !(value.slot === 'capacity' && value.code === CAPACITY_UNIT.millilitres)),
      dictionary.slotRules(),
      { renames: dictionary.renames(), retired: dictionary.retired() },
    ));

    const ounces = await decode.execute({ code: 'BWL.CBG.Y.Y.Y.X.Q0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X' });
    if (!ounces.ok) throw ounces.error;
    expect(ounces.value.slots.find((slot) => slot.key === 'capacity')?.meaning).toBe('14 oz');
    const millilitres = await decode.execute({ code: 'BWL.CBG.Y.Y.Y.X.M0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X' });
    expect(millilitres.ok).toBe(false);
  });
});
