import type { TokenGenerator } from '../../domain/token-generator.js';

/**
 * The TokenGenerator contract, with predictable tokens. A test double, never
 * used in production — tests can assert on, and construct, exact values.
 */
export class FakeTokenGenerator implements TokenGenerator {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `token-${this.count}`;
  }

  hash(token: string): string {
    return `hash(${token})`;
  }
}
