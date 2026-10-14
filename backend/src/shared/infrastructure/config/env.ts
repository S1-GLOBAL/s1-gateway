import { z } from 'zod';
import { err, ok, type Result } from '../../domain/result.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated once, at boot. A bad value fails here with the variable's name,
 * not three layers deep inside a request an hour later.
 */
export function parseEnv(source: Record<string, string | undefined>): Result<Env, string[]> {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return ok(parsed.data);
  return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
}
