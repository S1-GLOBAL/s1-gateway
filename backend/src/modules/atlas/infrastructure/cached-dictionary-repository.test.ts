import { describe, expect, it, vi } from 'vitest';
import type { Dictionary, DictionaryChangeStamp } from '../domain/dictionary.js';
import { applyProposal } from '../domain/suggestions/apply-proposal.js';
import { s1Dictionary } from '../domain/testing/s1-dictionary.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { CachedDictionaryRepository, type DictionarySource } from './cached-dictionary-repository.js';

/** A source holding one live dictionary, counting how often each release is read whole. */
function sourceOf(start: Dictionary) {
  let live = start;
  const source = {
    get: vi.fn(async (release: string) => (release === 'S2 0.1.0' ? live : release === 'S1 0.1.0' ? s1Dictionary() : null)),
    latestChange: vi.fn(async (): Promise<DictionaryChangeStamp | null> => live.change),
  } satisfies DictionarySource;
  return { source, replace: (next: Dictionary) => (live = next) };
}

const APPROVED = { number: 1, at: new Date('2026-10-29T08:00:00.000Z') };

describe('CachedDictionaryRepository', () => {
  it('reads the live release whole once, then only asks for the latest change', async () => {
    const { source } = sourceOf(s2Dictionary());
    const cached = new CachedDictionaryRepository(source);

    const first = await cached.get('S2 0.1.0');
    const second = await cached.get('S2 0.1.0');

    expect(second).toBe(first);
    expect(source.get).toHaveBeenCalledTimes(1);
    expect(source.latestChange).toHaveBeenCalledTimes(2);
  });

  it('reads it again once an approval has moved the latest change', async () => {
    const { source, replace } = sourceOf(s2Dictionary());
    const cached = new CachedDictionaryRepository(source);
    await cached.get('S2 0.1.0');

    const approved = applyProposal(
      s2Dictionary(),
      { slot: 'material', code: 'AZZ' },
      { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null },
      APPROVED,
    );
    replace(approved);

    expect(await cached.get('S2 0.1.0')).toBe(approved);
    expect(source.get).toHaveBeenCalledTimes(2);
  });

  it('reads it again when the dictionary is put back to before any change', async () => {
    const approved = applyProposal(
      s2Dictionary(),
      { slot: 'material', code: 'AZZ' },
      { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null },
      APPROVED,
    );
    const { source, replace } = sourceOf(approved);
    const cached = new CachedDictionaryRepository(source);
    await cached.get('S2 0.1.0');

    const seeded = s2Dictionary();
    replace(seeded);

    expect(await cached.get('S2 0.1.0')).toBe(seeded);
  });

  it('reads an older release as it always was', async () => {
    const { source } = sourceOf(s2Dictionary());
    const cached = new CachedDictionaryRepository(source);

    await cached.get('S1 0.1.0');
    await cached.get('S1 0.1.0');

    expect(source.get).toHaveBeenCalledTimes(2);
    expect(source.latestChange).not.toHaveBeenCalled();
  });
});
