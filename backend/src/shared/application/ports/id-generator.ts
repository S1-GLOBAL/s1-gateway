export interface IdGenerator {
  /** A new, unique identifier — a UUID in production. */
  next(): string;
}
