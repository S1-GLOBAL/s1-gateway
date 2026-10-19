import { describe, expect, it } from 'vitest';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { WORD_LIST } from './word-list.js';

const dictionary = s2Dictionary();

describe('WORD_LIST', () => {
  it('means only codes of S2 0.1.0, each in its own slot', () => {
    for (const [phrase, meaning] of Object.entries(WORD_LIST)) {
      const [slot, code] = Object.entries(meaning)[0] as ['productType' | 'material', string];
      expect(dictionary.meaningOf(slot, code), phrase).toBeDefined();
    }
  });

  it('writes each phrase in lower case, trimmed, with no run of spaces', () => {
    for (const phrase of Object.keys(WORD_LIST)) {
      expect(phrase).toBe(phrase.toLowerCase().replace(/\s+/g, ' ').trim());
      expect(phrase.length).toBeGreaterThan(0);
    }
  });

  it('knows a bowl lid, a clamshell, bagasse and PP', () => {
    expect(WORD_LIST['bowl lid']).toEqual({ productType: 'BLD' });
    expect(WORD_LIST.clamshell).toEqual({ productType: 'HCT' });
    expect(WORD_LIST.bagasse).toEqual({ material: 'CBG' });
    expect(WORD_LIST.pp).toEqual({ material: 'APP' });
  });
});
