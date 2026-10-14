import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from './contrast';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('gives the figures ADR 0011 is built on', () => {
    expect(contrastRatio('#c8f135', '#ffffff')).toBeCloseTo(1.31, 2);
    expect(contrastRatio('#466d00', '#ffffff')).toBeCloseTo(6.09, 2);
    expect(contrastRatio('#111310', '#c8f135')).toBeCloseTo(14.31, 2);
  });

  it('does not care which colour is the text', () => {
    expect(contrastRatio('#466d00', '#ffffff')).toBe(contrastRatio('#ffffff', '#466d00'));
  });

  it('reads three-digit hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('returns null for anything that is not a hex colour', () => {
    expect(contrastRatio('rgb(0 0 0)', '#ffffff')).toBeNull();
  });
});

describe('meetsAA', () => {
  it('needs 4.5:1 for body text', () => {
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(4.49)).toBe(false);
  });
});
