import { describe, expect, it } from 'vitest';
import { InvalidFullNameError, normalizeFullName } from './full-name.js';

describe('normalizeFullName', () => {
  it('accepts a single character', () => {
    expect(normalizeFullName('A')).toEqual({ ok: true, value: 'A' });
  });

  it('accepts 80 characters', () => {
    const name = 'A'.repeat(80);
    expect(normalizeFullName(name)).toEqual({ ok: true, value: name });
  });

  it('rejects empty after trim', () => {
    const result = normalizeFullName('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InvalidFullNameError);
      expect(result.error.message).toBe('Enter First and Last name.');
    }
  });

  it('rejects 81 characters', () => {
    const result = normalizeFullName('A'.repeat(81));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Use at most 80 characters.');
    }
  });
});
