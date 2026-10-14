import { z } from 'zod';
import { HttpError } from './http-error.js';

/**
 * Checks the request body's shape. Business rules are the domain's job; this
 * only guarantees the use case receives the types it declares.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const flattened = z.flattenError(parsed.error);
  throw new HttpError(400, 'VALIDATION_FAILED', 'The request body is not valid.', {
    fields: flattened.fieldErrors,
    form: flattened.formErrors,
  });
}
