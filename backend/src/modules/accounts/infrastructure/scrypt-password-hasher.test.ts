import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  it('round-trips a password and rejects the wrong one', async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('correct-horse-battery');
    expect(hash).not.toContain('correct-horse-battery');
    expect(await hasher.verify('correct-horse-battery', hash)).toBe(true);
    expect(await hasher.verify('wrong-password', hash)).toBe(false);
  });
});
