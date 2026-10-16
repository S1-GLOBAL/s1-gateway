import { describe, expect, it } from 'vitest';
import { hashPassword, hashToken, newResetToken, newSessionToken, verifyPassword } from './crypto.js';

describe('password hashing', () => {
  it('round-trips a password with scrypt', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).not.toContain('correct-horse');
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('tokens', () => {
  it('makes url-safe session and reset tokens', () => {
    const session = newSessionToken();
    const reset = newResetToken();
    expect(session).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(reset).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(session).not.toBe(reset);
    expect(Buffer.from(session, 'base64url').length).toBe(32);
  });

  it('hashes tokens with sha-256 hex', () => {
    const hash = hashToken('abc');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken('abc')).toBe(hash);
    expect(hashToken('abd')).not.toBe(hash);
  });
});
