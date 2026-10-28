import { describe, expect, it } from 'vitest';
import type { SpecIdChange } from './atlas';
import { dictionaryChangeLine, dictionaryChangePath, historySentence, inFilter, type HistoryFilter } from './history-entry';

const ben = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };
const height = { key: 'height' as const, name: 'Height', before: 'Not known', after: '62 mm', corrected: false };

function change(changes: Partial<SpecIdChange> = {}): SpecIdChange {
  return {
    kind: 'updated',
    changedBy: ben,
    changedAt: new Date('2026-10-17T14:32:00Z'),
    codeBefore: 'S1.BEFORE',
    codeAfter: 'S1.AFTER',
    nameBefore: 'Lid',
    nameAfter: 'Lid',
    slots: [height],
    dictionaryChange: null,
    ...changes,
  };
}

const created = change({ kind: 'created', codeBefore: null, nameBefore: null, slots: [] });

describe('historySentence', () => {
  it('says who created it', () => {
    expect(historySentence(created)).toBe('Ben Invented created it');
  });

  it('counts one fact, and more than one', () => {
    expect(historySentence(change())).toBe('Ben Invented updated 1 fact');
    expect(historySentence(change({ slots: [height, { ...height, key: 'width', name: 'Width' }] }))).toBe(
      'Ben Invented updated 2 facts',
    );
  });

  it('says a rename alone, and a rename with facts', () => {
    expect(historySentence(change({ nameAfter: 'Big lid', slots: [] }))).toBe('Ben Invented renamed it');
    expect(historySentence(change({ nameAfter: 'Big lid' }))).toBe('Ben Invented updated 1 fact and renamed it');
  });
});

describe('inFilter', () => {
  it('keeps a rename alone out of Facts, and a change of facts out of Name', () => {
    const rename = change({ nameAfter: 'Big lid', slots: [] });
    expect(inFilter(rename, 'facts')).toBe(false);
    expect(inFilter(rename, 'name')).toBe(true);
    expect(inFilter(change(), 'facts')).toBe(true);
    expect(inFilter(change(), 'name')).toBe(false);
  });

  it('keeps the creation in All only', () => {
    const filters: HistoryFilter[] = ['all', 'facts', 'name'];
    expect(filters.map((filter) => inFilter(created, filter))).toEqual([true, false, false]);
  });
});

describe('dictionaryChangeLine', () => {
  const ada = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

  it("names the change, who suggested it and who approved it, in #95's words", () => {
    const entry = change({ dictionaryChange: { number: 3, suggestedBy: ada, approvedBy: ben } });
    expect(dictionaryChangeLine(entry)).toBe('Changed by dictionary change #3 — suggested by Ada Invented, approved by Ben Invented');
    expect(dictionaryChangePath(3)).toBe('/dictionary/changes?change=3');
  });

  it("says nothing for a person's own edit", () => {
    expect(dictionaryChangeLine(change())).toBeNull();
  });
});
