import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from '../domain/atlas';
import { searchDictionary } from './dictionary-search';

const dictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', number: 1, searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', number: 3, searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [{ code: 'APT', meaning: 'Polymer, PET', number: 1, searchWords: [] }],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [{ code: 'RD', meaning: 'Round', number: 1, searchWords: [] }],
    },
  ],
  rules: [],
};

describe('searchDictionary', () => {
  it('matches a code or a meaning across every slot, and ignores an empty query', () => {
    expect(searchDictionary(dictionary, '   ').map((hit) => hit.code)).toEqual([]);
    expect(searchDictionary(dictionary, 'lid').map((hit) => hit.code)).toEqual(['BLD']);
    expect(searchDictionary(dictionary, 'pet').map((hit) => [hit.code, hit.slotName])).toEqual([['APT', 'Material']]);
  });

  it('finds a value by its code as written today, the exact one first', () => {
    expect(searchDictionary(dictionary, 'e1').map((hit) => [hit.code, hit.part])).toEqual([['RD', 'E1']]);
    expect(searchDictionary(dictionary, 'A3').map((hit) => hit.code)).toEqual(['BWL']);
    expect(searchDictionary(dictionary, 'a').map((hit) => hit.part).slice(0, 2)).toEqual(['A1', 'A3']);
  });

  it('puts an exact code before a meaning that only contains the text', () => {
    expect(searchDictionary(dictionary, 'rd').map((hit) => hit.code)).toEqual(['RD']);
    expect(searchDictionary(dictionary, 'bo').map((hit) => hit.code)).toEqual(['BLD', 'BWL']);
  });
});
