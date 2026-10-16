import { describe, expect, it } from 'vitest';
import { EmailNotAllowedError, normalizeCompanyEmail } from './email.js';

describe('normalizeCompanyEmail', () => {
  it('accepts a company address and stores it lower-case', () => {
    const result = normalizeCompanyEmail('  A@SourceOne.Global  ');
    expect(result).toEqual({ ok: true, value: 'a@sourceone.global' });
  });

  it('rejects gmail', () => {
    const result = normalizeCompanyEmail('a@gmail.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(EmailNotAllowedError);
      expect(result.error.code).toBe('EMAIL_NOT_ALLOWED');
      expect(result.error.message).toBe('Use your @sourceone.global email address.');
    }
  });

  it('rejects a mail subdomain', () => {
    const result = normalizeCompanyEmail('a@mail.sourceone.global');
    expect(result.ok).toBe(false);
  });

  it('rejects a suffix trick', () => {
    const result = normalizeCompanyEmail('a@sourceone.global.evil.com');
    expect(result.ok).toBe(false);
  });
});
