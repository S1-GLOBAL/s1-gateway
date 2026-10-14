import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway';

describe('parseEnv', () => {
  it('fills in defaults when only the database is given', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      ok: true,
      value: {
        NODE_ENV: 'development',
        PORT: 4000,
        LOG_LEVEL: 'info',
        DATABASE_URL,
        CORS_ORIGIN: 'http://localhost:5173',
      },
    });
  });

  it('reads PORT as a number', () => {
    const result = parseEnv({ DATABASE_URL, PORT: '8080' });
    expect(result.ok && result.value.PORT).toBe(8080);
  });

  it('names the missing variable', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });

  it('rejects a database URL that is not Postgres', () => {
    const result = parseEnv({ DATABASE_URL: 'mysql://localhost/s1' });
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });
});
