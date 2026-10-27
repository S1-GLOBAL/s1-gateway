import { describe, expect, it } from 'vitest';
import type { AtlasDictionary } from '../domain/atlas';
import { searchDictionary } from './dictionary-search';

const dictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid' },
        { code: 'BWL', meaning: 'Bowl' },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [{ code: 'APT', meaning: 'Polymer, PET' }],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [{ code: 'RD', meaning: 'Round' }],
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

  it('puts an exact code before a meaning that only contains the text', () => {
    expect(searchDictionary(dictionary, 'rd').map((hit) => hit.code)).toEqual(['RD']);
    expect(searchDictionary(dictionary, 'bo').map((hit) => hit.code)).toEqual(['BLD', 'BWL']);
  });
});
