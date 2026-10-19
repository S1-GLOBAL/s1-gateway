import { describe, expect, it } from 'vitest';
import type { SearchableSlotKey } from './similar-match.js';
import { classifyMatch, isSearchableSlot } from './similar-match.js';

/** A saved Spec ID reduced to the slots a lookup can ask about. */
const slotsOf = (values: Partial<Record<SearchableSlotKey, string>>) => (key: SearchableSlotKey) =>
  values[key] ?? 'Y';

describe('classifyMatch for a request of a 90 mm top diameter', () => {
  const criteria = { topDiameter: '0090' };

  it('fits a saved 90 mm rim', () => {
    expect(classifyMatch(slotsOf({ topDiameter: '0090' }), criteria)).toBe('fits');
  });

  it('might fit a rim nobody has stated', () => {
    expect(classifyMatch(slotsOf({ topDiameter: 'Y' }), criteria)).toBe('might-fit');
  });

  it('excludes 91 mm: nothing is compared by closeness', () => {
    expect(classifyMatch(slotsOf({ topDiameter: '0091' }), criteria)).toBe('excluded');
  });

  it('excludes a rim that never applies', () => {
    expect(classifyMatch(slotsOf({ topDiameter: 'X' }), criteria)).toBe('excluded');
  });
});

describe('classifyMatch', () => {
  it('fits everything when nothing is chosen', () => {
    expect(classifyMatch(slotsOf({ topDiameter: '0091' }), {})).toBe('fits');
  });

  it('excludes when any chosen slot differs, even if another is not known', () => {
    const slotOf = slotsOf({ topDiameter: 'Y', shape: 'SQ' });
    expect(classifyMatch(slotOf, { topDiameter: '0090', shape: 'RD' })).toBe('excluded');
  });

  it('might fit when one slot equals and another is not known', () => {
    const slotOf = slotsOf({ topDiameter: 'Y', shape: 'RD' });
    expect(classifyMatch(slotOf, { topDiameter: '0090', shape: 'RD' })).toBe('might-fit');
  });
});

describe('isSearchableSlot', () => {
  it('knows the slots from product type to thickness, and no others', () => {
    expect(isSearchableSlot('productType')).toBe(true);
    expect(isSearchableSlot('thickness')).toBe(true);
    expect(isSearchableSlot('formatVersion')).toBe(false);
    expect(isSearchableSlot('variant')).toBe(false);
    expect(isSearchableSlot('constructor')).toBe(false);
  });
});
