import { describe, expect, it } from 'vitest';
import type { DecodedSlot, DecodedSpecId, SlotKey } from './atlas';
import { compareCodes, factsCriteria, factsOf, withSameFacts } from './same-facts';

describe('same facts, other sizes', () => {
  it("reads a code's facts, the part before the hyphen", () => {
    expect(factsOf('A1B1E1-N170')).toBe('A1B1E1');
    expect(factsOf('A1B1E1')).toBe('A1B1E1');
  });

  it('orders codes as a person reads them, a code of facts alone first', () => {
    expect(['A1B1E1-N95', 'A10B1', 'A1B1E1-N170', 'A1B1E1', 'A1B1E1-H90N95'].sort(compareCodes)).toEqual([
      'A1B1E1',
      'A1B1E1-H90N95',
      'A1B1E1-N95',
      'A1B1E1-N170',
      'A10B1',
    ]);
  });

  it('keeps those with exactly the same facts, at any size, in reading order', () => {
    const saved = ['A1B1E1-N170', 'A1B1E1F3-H120N58', 'A1B1E1', 'A1B1-N170', 'A1B1E1-N95'].map((code) => ({ code }));
    expect(withSameFacts('A1B1E1-N170', saved).map(({ code }) => code)).toEqual(['A1B1E1', 'A1B1E1-N95', 'A1B1E1-N170']);
  });

  it("asks for a code's facts with its sizes left out", () => {
    const slot = (key: SlotKey, raw: string, part: string, state: DecodedSlot['state'] = 'value'): DecodedSlot => ({
      number: 0,
      key,
      name: key,
      raw,
      part,
      state,
      meaning: '',
    });
    const decoded: DecodedSpecId = {
      code: 'A1B4-H90N170',
      dictionaryRelease: 'S2 0.1.0',
      slots: [
        slot('productType', 'BLD', 'A1'),
        slot('material', 'APS', 'B4'),
        slot('coating', 'Y', '', 'not-known'),
        slot('topDiameter', '0090', 'H90'),
        slot('unitWeight', '0170', 'N170'),
      ],
    };
    expect(factsCriteria(decoded)).toEqual({ productType: 'BLD', material: 'APS' });
  });
});
