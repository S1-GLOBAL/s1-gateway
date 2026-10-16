import { describe, expect, it } from 'vitest';
import { SlidingWindowSignUpRateLimiter } from './sliding-window-sign-up-rate-limiter.js';

const START = new Date('2026-10-16T08:00:00.000Z');

describe('SlidingWindowSignUpRateLimiter', () => {
  it('allows five sign-ups per IP per hour and refuses the sixth', async () => {
    const limiter = new SlidingWindowSignUpRateLimiter();
    for (let i = 0; i < 5; i += 1) {
      expect(await limiter.tryConsume('1.1.1.1', START)).toBe(true);
    }
    expect(await limiter.tryConsume('1.1.1.1', START)).toBe(false);
  });

  it('tracks each IP independently', async () => {
    const limiter = new SlidingWindowSignUpRateLimiter();
    for (let i = 0; i < 5; i += 1) await limiter.tryConsume('1.1.1.1', START);
    expect(await limiter.tryConsume('2.2.2.2', START)).toBe(true);
  });

  it('allows another attempt once the window has rolled past an hour', async () => {
    const limiter = new SlidingWindowSignUpRateLimiter();
    for (let i = 0; i < 5; i += 1) await limiter.tryConsume('1.1.1.1', START);
    const anHourLater = new Date(START.getTime() + 60 * 60 * 1000 + 1);
    expect(await limiter.tryConsume('1.1.1.1', anHourLater)).toBe(true);
  });
});
