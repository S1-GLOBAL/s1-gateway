import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from './atlas';
import { dictionaryHeading } from './dictionary-heading';

const dictionary: AtlasDictionary = { release: 'S2 0.1.0', approvedOn: '2026-10-19', slots: [], rules: [], change: null };

describe('dictionaryHeading', () => {
  it("names the release and the day it was approved, before the first change, in #95's words", () => {
    expect(dictionaryHeading(dictionary, 'UTC')).toBe('S2, approved 19 October 2026.');
  });

  it("names the latest change and its day, in #95's words", () => {
    const changed = { ...dictionary, change: { number: 3, at: new Date('2026-10-27T09:30:00.000Z') } };
    expect(dictionaryHeading(changed, 'UTC')).toBe('S2, change 3, 27 October 2026.');
  });
});
