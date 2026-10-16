/**
 * Makes the random tokens handed to a browser (session cookie) or printed in
 * a reset link, and the one-way hash of each that is safe to store. The
 * domain owns this port; infrastructure implements it.
 */
export interface TokenGenerator {
  /** A new random, URL-safe token. Never stored — only its hash is. */
  generate(): string;

  /** The deterministic hash of a token, as stored and looked up by. */
  hash(token: string): string;
}
