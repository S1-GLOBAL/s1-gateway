import { describe, expect, it } from 'vitest';
import { InvalidPasswordError, validatePassword } from './password.js';

describe('validatePassword', () => {
  it('accepts a 12-character password', () => {
    expect(validatePassword('123456789012')).toEqual({ ok: true, value: '123456789012' });
  });

  it('rejects an 11-character password', () => {
    const result = validatePassword('12345678901');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
      expect(result.error.message).toBe('Use at least 12 characters.');
    }
  });
});
