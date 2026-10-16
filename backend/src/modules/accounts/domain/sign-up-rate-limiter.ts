/**
 * Caps successful sign-ups per client IP per hour. The domain owns this port;
 * infrastructure implements it (in memory — nothing here needs a table).
 */
export interface SignUpRateLimiter {
  /**
   * Atomically checks the hourly limit for this IP and, only if under it,
   * records this sign-up. Returns whether the sign-up may proceed.
   */
  tryConsume(clientIp: string, now: Date): Promise<boolean>;
}
