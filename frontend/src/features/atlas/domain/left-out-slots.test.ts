import { describe, expect, it } from 'vitest';
import { testDictionary } from '../application/testing/atlas-fixtures';
import { joinNames, leftOutSlots } from './left-out-slots';

describe('leftOutSlots', () => {
  it('names the slots a bowl lid never has, while its shape and material are not known', () => {
    expect(leftOutSlots(testDictionary.rules, 'BLD', '', '')).toEqual(['capacity', 'bottomDiameter', 'gusset']);
  });

  it('adds the slots a round shape and a plastic rule out', () => {
    expect(leftOutSlots(testDictionary.rules, 'BLD', 'RD', 'APS')).toEqual([
      'capacity',
      'bottomDiameter',
      'length',
      'width',
      'gusset',
      'basisWeight',
    ]);
  });
});

describe('joinNames', () => {
  it('joins with commas and a last "and"', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['gusset'])).toBe('gusset');
    expect(joinNames(['profile', 'gusset'])).toBe('profile and gusset');
    expect(joinNames(['nominal capacity', 'bottom diameter', 'gusset'])).toBe(
      'nominal capacity, bottom diameter and gusset',
    );
  });
});
