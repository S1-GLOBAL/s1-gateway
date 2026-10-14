const UNIQUE_VIOLATION = '23505';

/**
 * Postgres reports a broken unique index as SQLSTATE 23505. Drizzle may wrap
 * the driver's error, so the code is looked for on the error and its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === UNIQUE_VIOLATION || candidate.cause?.code === UNIQUE_VIOLATION;
}
