import type { PasswordHasher } from '../../domain/password-hasher.js';

/**
 * The PasswordHasher contract, without real cryptography. A test double,
 * never used in production — hashes are reversible and fast on purpose.
 */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake$${password}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    return storedHash === `fake$${password}`;
  }
}
