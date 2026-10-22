import { describe, expect, it } from 'vitest';
import { buildKeepingWhatFits } from './build-keeping-what-fits.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

const dictionary = s2Dictionary();

describe('buildKeepingWhatFits', () => {
  it('drops a fact the product type cannot have, says why, and builds without it', () => {
    const kept = buildKeepingWhatFits({ productType: 'CLD', material: 'APT', capacity: { unit: 'Z', value: '14' } }, dictionary);

    expect(kept.specId?.slot('capacity')).toBe('X');
    expect(kept.facts).toEqual({ productType: 'CLD', material: 'APT' });
    expect(kept.dropped).toEqual([{ key: 'capacity', reasons: [expect.any(String)] }]);
  });

  it('keeps every fact that fits', () => {
    const kept = buildKeepingWhatFits({ productType: 'CUP', material: 'APP', capacity: { unit: 'Z', value: '16' } }, dictionary);

    expect(kept.specId?.slot('capacity')).toBe('Z0016');
    expect(kept.dropped).toEqual([]);
  });

  it('builds nothing without a product type, or with one the dictionary does not have', () => {
    expect(buildKeepingWhatFits({ material: 'APP' }, dictionary).specId).toBeNull();
    expect(buildKeepingWhatFits({ productType: 'QQQ' }, dictionary).specId).toBeNull();
  });
});
