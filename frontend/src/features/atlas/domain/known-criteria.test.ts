import { describe, expect, it } from 'vitest';
import { ILLUSTRATIVE, readCode } from '../application/testing/atlas-fixtures';
import { knownCriteria } from './known-criteria';

describe('knownCriteria', () => {
  it('asks about each known slot by its text, never S2 or the variant', () => {
    expect(knownCriteria(readCode(ILLUSTRATIVE))).toEqual({
      productType: 'BLD',
      material: 'APS',
      colourClarity: 'CL',
      shape: 'RD',
      profile: 'DM',
      topDiameter: '0090',
      unitWeight: '0033',
    });
  });
});
