import { describe, expect, it } from 'vitest';
import { checkName, SavedSpecId } from './saved-spec-id.js';
import { SpecId } from './spec-id.js';
import { s1Dictionary } from './testing/s1-dictionary.js';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const specId = (() => {
  const parsed = SpecId.parse(ILLUSTRATIVE, s1Dictionary());
  if (!parsed.ok) throw parsed.error;
  return parsed.value;
})();

const create = (name: string) =>
  SavedSpecId.create({
    id: '00000000-0000-4000-8000-000000000001',
    specId,
    name,
    dictionaryRelease: 'S1 0.1.0',
    savedBy: '00000000-0000-4000-8000-0000000000aa',
    savedAt: new Date('2026-10-16T08:00:00.000Z'),
  });

describe('SavedSpecId.create', () => {
  it('keeps a name of 1 character', () => {
    const result = create('L');
    expect(result.ok && result.value.name).toBe('L');
  });

  it('keeps a name of 120 characters', () => {
    const result = create('a'.repeat(120));
    expect(result.ok && result.value.name).toBe('a'.repeat(120));
  });

  it('trims the name before counting and keeping it', () => {
    const result = create(`  ${'a'.repeat(120)}  `);
    expect(result.ok && result.value.name).toBe('a'.repeat(120));
  });

  it('refuses a name of 121 characters', () => {
    const result = create('a'.repeat(121));
    expect(!result.ok && result.error.issues).toEqual({ name: ['Name must be at most 120 characters.'] });
  });

  it('refuses a name of only spaces', () => {
    const result = create('   ');
    expect(!result.ok && result.error.issues).toEqual({ name: ['Name is required.'] });
  });

  it('refuses a name with a control character', () => {
    const result = create('Illustrative\u0007 lid');
    expect(!result.ok && result.error.issues).toEqual({ name: ['Name must not contain control characters.'] });
  });

  it('refuses a name with DEL', () => {
    expect(checkName('a\u007fb')).toEqual(['Name must not contain control characters.']);
  });

  it('keeps the code, the release, who saved it and when', () => {
    const result = create('Illustrative lid');
    if (!result.ok) throw result.error;
    expect(result.value.specId.code).toBe(ILLUSTRATIVE);
    expect(result.value.dictionaryRelease).toBe('S1 0.1.0');
    expect(result.value.savedBy).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(result.value.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
  });
});

describe('checkName', () => {
  it('has nothing to say about a good name', () => {
    expect(checkName('Illustrative lid')).toEqual([]);
  });
});
