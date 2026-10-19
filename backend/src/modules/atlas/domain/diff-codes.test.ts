import { describe, expect, it } from 'vitest';
import { diffCodes } from './diff-codes.js';
import { SpecId, type SpecIdFactsInput } from './spec-id.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

function built(facts: SpecIdFactsInput): SpecId {
  const result = SpecId.build(facts, s2Dictionary());
  if (!result.ok) throw result.error;
  return result.value;
}

const KRAFT_BOWL = { productType: 'BWL', material: 'BKR', shape: 'RD' } as const;

describe('diffCodes', () => {
  it('gives no rows for identical codes', () => {
    expect(diffCodes(built(KRAFT_BOWL), built(KRAFT_BOWL))).toEqual([]);
  });

  it('gives one row for a height that was not known, which is not a correction', () => {
    const before = built({ ...KRAFT_BOWL, unitWeight: { value: '12', unit: 'g' } });
    const after = built({ ...KRAFT_BOWL, unitWeight: { value: '12', unit: 'g' }, height: { value: '62', unit: 'mm' } });
    expect(diffCodes(before, after)).toEqual([{ key: 'height', before: '0000', after: '0062', corrected: false }]);
  });

  it('marks a known unit weight replaced by another as corrected', () => {
    const before = built({ ...KRAFT_BOWL, unitWeight: { value: '12', unit: 'g' } });
    const after = built({ ...KRAFT_BOWL, unitWeight: { value: '11.8', unit: 'g' } });
    expect(diffCodes(before, after)).toEqual([{ key: 'unitWeight', before: '0120', after: '0118', corrected: true }]);
  });

  it('marks a known value that stops applying as corrected, and a slot that was X as not', () => {
    const bowl = built({ ...KRAFT_BOWL, capacity: { unit: 'Z', value: '16' } });
    const lid = built({ productType: 'BLD', material: 'BKR', shape: 'RD' });
    const rows = diffCodes(bowl, lid);
    expect(rows).toContainEqual({ key: 'productType', before: 'BWL', after: 'BLD', corrected: true });
    expect(rows).toContainEqual({ key: 'capacity', before: 'Z0016', after: 'XXXXX', corrected: true });
    expect(rows).toContainEqual({ key: 'profile', before: 'XX', after: '00', corrected: false });
    expect(rows).toContainEqual({ key: 'bottomDiameter', before: '0000', after: 'XXXX', corrected: false });
  });

  it('lists the rows in code order', () => {
    const bowl = built({ ...KRAFT_BOWL, capacity: { unit: 'Z', value: '16' } });
    const lid = built({ productType: 'BLD', material: 'BKR', shape: 'RD' });
    expect(diffCodes(bowl, lid).map((row) => row.key)).toEqual([
      'productType',
      'profile',
      'capacity',
      'bottomDiameter',
      'wall',
      'compartments',
    ]);
  });
});
