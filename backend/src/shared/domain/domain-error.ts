/**
 * A business rule was broken. `code` is stable and machine-readable; the
 * presentation layer maps it to a transport status. `message` is safe to show
 * to a user.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
