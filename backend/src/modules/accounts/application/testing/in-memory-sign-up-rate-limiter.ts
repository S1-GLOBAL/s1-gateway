import type { SignUpRateLimiter } from '../../domain/sign-up-rate-limiter.js';

const WINDOW_MS = 60 * 60 * 1000;

/** The SignUpRateLimiter contract, in memory. A test double, never used in production. */
export class InMemorySignUpRateLimiter implements SignUpRateLimiter {
  private readonly attemptsByIp = new Map<string, number[]>();

  async tryConsume(clientIp: string, now: Date): Promise<boolean> {
    const cutoff = now.getTime() - WINDOW_MS;
    const attempts = (this.attemptsByIp.get(clientIp) ?? []).filter((at) => at > cutoff);
    if (attempts.length >= 5) {
      this.attemptsByIp.set(clientIp, attempts);
      return false;
    }
    attempts.push(now.getTime());
    this.attemptsByIp.set(clientIp, attempts);
    return true;
  }
}
