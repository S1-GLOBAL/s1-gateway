import type { PasswordHasher } from '../domain/password-hasher.js';
import { hashPassword, verifyPassword } from './crypto.js';

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    return verifyPassword(password, storedHash);
  }
}
