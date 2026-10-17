import { describe, expect, it } from 'vitest';
import { checkPasswordsMatch, InvalidPasswordError, PasswordsDontMatchError, validatePassword } from './password.js';

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

describe('checkPasswordsMatch', () => {
  it('accepts a confirmation equal to the password', () => {
    expect(checkPasswordsMatch('123456789012', '123456789012')).toEqual({ ok: true, value: undefined });
  });

  it('refuses a different confirmation under confirmPassword', () => {
    const result = checkPasswordsMatch('123456789012', '123456789013');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PasswordsDontMatchError);
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toBe("The passwords don't match.");
      expect(result.error.details).toEqual({ fields: { confirmPassword: ["The passwords don't match."] } });
    }
  });
});
