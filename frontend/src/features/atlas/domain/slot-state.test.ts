import { describe, expect, it } from 'vitest';
import { testDictionary } from '../application/testing/atlas-fixtures';
import { slotStateFor } from './slot-state';

const { rules } = testDictionary;

describe('slotStateFor', () => {
  it('is any for a slot that applies, whatever the shape and material', () => {
    expect(slotStateFor(rules, 'BLD', 'height', '', '')).toBe('any');
    expect(slotStateFor(rules, 'BLD', 'height', 'RD', 'APS')).toBe('any');
  });

  it('is does-not-apply for a slot the product type never has', () => {
    expect(slotStateFor(rules, 'BLD', 'capacity', '', '')).toBe('does-not-apply');
    expect(slotStateFor(rules, 'BLD', 'gusset', 'RD', 'BPA')).toBe('does-not-apply');
  });

  it('unlocks a slot one product type never has and another does', () => {
    expect(slotStateFor(rules, 'BWL', 'capacity', '', '')).toBe('any');
    expect(slotStateFor(rules, 'BWL', 'profile', '', '')).toBe('does-not-apply');
    expect(slotStateFor(rules, 'BLD', 'profile', '', '')).toBe('any');
  });

  it.each([
    ['', 'not-known'],
    ['RD', 'any'],
    ['SQ', 'does-not-apply'],
  ])('follows a round-only slot for shape %j', (shape, expected) => {
    expect(slotStateFor(rules, 'BLD', 'topDiameter', shape, '')).toBe(expected);
  });

  it.each([
    ['', 'not-known'],
    ['RD', 'does-not-apply'],
    ['SQ', 'any'],
  ])('follows a non-round-only slot for shape %j', (shape, expected) => {
    expect(slotStateFor(rules, 'BLD', 'length', shape, '')).toBe(expected);
  });

  it.each([
    ['', 'not-known'],
    ['BPA', 'any'],
    ['APS', 'does-not-apply'],
  ])('follows a paper-only slot for material %j', (material, expected) => {
    expect(slotStateFor(rules, 'BLD', 'basisWeight', '', material)).toBe(expected);
  });

  it('is any for a slot with no rule, such as material', () => {
    expect(slotStateFor(rules, 'BLD', 'material', '', '')).toBe('any');
  });
});
