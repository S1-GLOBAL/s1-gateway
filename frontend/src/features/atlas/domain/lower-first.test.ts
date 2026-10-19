import { describe, expect, it } from 'vitest';
import { lowerFirst } from './lower-first';

describe('lowerFirst', () => {
  it('lowers only the first letter, so a code in brackets keeps its capitals', () => {
    expect(lowerFirst('Shipping box (RSC)')).toBe('shipping box (RSC)');
    expect(lowerFirst('Bowl lid')).toBe('bowl lid');
    expect(lowerFirst('')).toBe('');
  });
});
