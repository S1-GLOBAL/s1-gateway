import type { SignUpRateLimiter } from '../domain/sign-up-rate-limiter.js';

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;

/**
 * Caps sign-ups per IP per hour, kept in process memory — no table needed,
 * and acceptable because the API runs as a single instance today.
 */
export class SlidingWindowSignUpRateLimiter implements SignUpRateLimiter {
  private readonly attemptsByIp = new Map<string, number[]>();

  async tryConsume(clientIp: string, now: Date): Promise<boolean> {
    const cutoff = now.getTime() - WINDOW_MS;
    const attempts = (this.attemptsByIp.get(clientIp) ?? []).filter((at) => at > cutoff);
    if (attempts.length >= LIMIT) {
      this.attemptsByIp.set(clientIp, attempts);
      return false;
    }
    attempts.push(now.getTime());
    this.attemptsByIp.set(clientIp, attempts);
    return true;
  }
}
