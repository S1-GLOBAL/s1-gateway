import { describe, expect, it } from 'vitest';
import { ILLUSTRATIVE, readCode } from '../application/testing/atlas-fixtures';
import { notKnownCount, summarise } from './spec-id-summary';

describe('summarise', () => {
  it('joins the known facts in code order, without S2 or the variant', () => {
    expect(summarise(readCode(ILLUSTRATIVE))).toBe('Bowl lid · APS · CL · RD · DM · 0090 · 0033');
  });
});

describe('notKnownCount', () => {
  it('counts the slots not known yet', () => {
    // Coating, height, thickness and print.
    expect(notKnownCount(readCode(ILLUSTRATIVE))).toBe(4);
  });
});
