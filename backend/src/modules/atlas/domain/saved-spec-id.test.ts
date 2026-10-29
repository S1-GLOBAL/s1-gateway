import { describe, expect, it } from 'vitest';
import { checkName, SavedSpecId } from './saved-spec-id.js';
import { SpecId } from './spec-id.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const specId = (() => {
  const parsed = SpecId.parse(ILLUSTRATIVE, s2Dictionary());
  if (!parsed.ok) throw parsed.error;
  return parsed.value;
})();

const create = (name: string) =>
  SavedSpecId.create({
    id: '00000000-0000-4000-8000-000000000001',
    specId,
    name,
    dictionaryRelease: 'S2 0.1.0',
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
    expect(result.value.specId.dottedCode).toBe(ILLUSTRATIVE);
    expect(result.value.dictionaryRelease).toBe('S2 0.1.0');
    expect(result.value.savedBy).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(result.value.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
  });
});

describe('checkName', () => {
  it('has nothing to say about a good name', () => {
    expect(checkName('Illustrative lid')).toEqual([]);
  });
});

describe('SavedSpecId.revise', () => {
  const saved = (() => {
    const result = create('Illustrative lid');
    if (!result.ok) throw result.error;
    return result.value;
  })();
  const revise = (name: string) =>
    saved.revise({
      specId,
      name,
      dictionaryRelease: 'S2 0.1.0',
      by: '00000000-0000-4000-8000-0000000000bb',
      at: new Date('2026-10-17T08:00:00.000Z'),
    });

  it('starts at version 1, changed by nobody yet', () => {
    expect(saved.version).toBe(1);
    expect(saved.updatedBy).toBeNull();
    expect(saved.updatedAt).toBeNull();
    expect(saved.lastChangedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
  });

  it('raises the version by 1, trims the name, and records who changed it and when', () => {
    const result = revise('  Clear dome lid  ');
    if (!result.ok) throw result.error;
    expect(result.value.version).toBe(2);
    expect(result.value.name).toBe('Clear dome lid');
    expect(result.value.updatedBy).toBe('00000000-0000-4000-8000-0000000000bb');
    expect(result.value.lastChangedAt.toISOString()).toBe('2026-10-17T08:00:00.000Z');
  });

  it('keeps its id, and who saved it first and when', () => {
    const result = revise('Clear dome lid');
    if (!result.ok) throw result.error;
    expect(result.value.id).toBe(saved.id);
    expect(result.value.savedBy).toBe(saved.savedBy);
    expect(result.value.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
  });

  it('refuses a name of 121 characters', () => {
    const result = revise('a'.repeat(121));
    expect(!result.ok && result.error.issues).toEqual({ name: ['Name must be at most 120 characters.'] });
  });
});
