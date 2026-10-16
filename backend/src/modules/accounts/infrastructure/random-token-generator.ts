import type { TokenGenerator } from '../domain/token-generator.js';
import { hashToken, newSessionToken } from './crypto.js';

/** Random tokens are the same shape whether they end up in a cookie or a reset link. */
export class RandomTokenGenerator implements TokenGenerator {
  generate(): string {
    return newSessionToken();
  }

  hash(token: string): string {
    return hashToken(token);
  }
}
