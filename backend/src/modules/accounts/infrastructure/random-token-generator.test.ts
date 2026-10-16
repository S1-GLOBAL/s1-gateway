import { describe, expect, it } from 'vitest';
import { RandomTokenGenerator } from './random-token-generator.js';

describe('RandomTokenGenerator', () => {
  it('generates distinct, url-safe tokens', () => {
    const tokens = new RandomTokenGenerator();
    const a = tokens.generate();
    const b = tokens.generate();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes a token deterministically', () => {
    const tokens = new RandomTokenGenerator();
    const token = tokens.generate();
    expect(tokens.hash(token)).toBe(tokens.hash(token));
    expect(tokens.hash(token)).not.toBe(token);
  });
});
