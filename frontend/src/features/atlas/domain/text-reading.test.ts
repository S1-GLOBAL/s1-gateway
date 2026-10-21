import { describe, expect, it } from 'vitest';
import { readCode } from '../application/testing/atlas-fixtures';
import type { SpecIdTextReading } from './atlas';
import { conflictSentence, readInWords } from './text-reading';

const BOWL = 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X';

const NOTHING: SpecIdTextReading = { read: [], ignored: [], conflicts: [], decoded: null };

describe('readInWords', () => {
  it("reads as the code's summary once there is a code", () => {
    expect(readInWords({ ...NOTHING, decoded: readCode(BOWL) })).toBe('Bowl lid · CBG · Z0014');
  });

  it("joins each fact's meaning when there is no code", () => {
    const reading: SpecIdTextReading = {
      ...NOTHING,
      read: [
        { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
        { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
      ],
    };
    expect(readInWords(reading)).toBe('Molded fibre, bagasse · 14 oz');
  });
});

describe('conflictSentence', () => {
  it('says "both" for two values', () => {
    expect(conflictSentence({ key: 'material', name: 'Material', found: ['PET', 'PP'] })).toBe(
      "Material: found both PET and PP, so it's left as not known.",
    );
  });

  it('lists three or more values without "both"', () => {
    expect(conflictSentence({ key: 'material', name: 'Material', found: ['PET', 'PP', 'PS'] })).toBe(
      "Material: found PET, PP and PS, so it's left as not known.",
    );
  });
});
