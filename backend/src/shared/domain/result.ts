/**
 * The outcome of an operation that can fail for a reason the caller is
 * expected to handle. Broken business rules travel as values, not exceptions,
 * so a use case's signature says what can go wrong.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
