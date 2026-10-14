import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { toAppError } from './to-app-error';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function responseError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: String(status),
    headers: {},
    config,
    data,
  });
}

describe('toAppError', () => {
  it('keeps the API error code, message and fields', () => {
    const error = toAppError(
      responseError(409, {
        error: { code: 'TOOL_NAME_TAKEN', message: 'Taken.', details: { fields: { name: ['Taken.'] } } },
      }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TOOL_NAME_TAKEN');
    expect(error.message).toBe('Taken.');
    expect(error.fields).toEqual({ name: ['Taken.'] });
  });

  it('names a timeout', () => {
    expect(toAppError(new AxiosError('timeout', 'ECONNABORTED', config)).code).toBe('TIMEOUT');
  });

  it('names a request that got no answer', () => {
    const error = toAppError(new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(error.code).toBe('NETWORK');
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('falls back to the status for a body that is not the API shape', () => {
    expect(toAppError(responseError(502, '<html>Bad gateway</html>')).code).toBe('HTTP_502');
  });

  it('wraps anything else', () => {
    expect(toAppError(new Error('boom')).code).toBe('UNKNOWN');
  });
});
