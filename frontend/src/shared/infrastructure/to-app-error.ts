import type { ApiErrorBody } from '@contracts/envelope';
import { isAxiosError } from 'axios';
import { AppError } from '@/shared/application/app-error';

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!isAxiosError(error)) return new AppError('UNKNOWN', 'Something went wrong. Try again.');

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new AppError('TIMEOUT', 'The server took too long to answer. Try again.');
  }
  if (!error.response) {
    return new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  const body = error.response.data as Partial<ApiErrorBody> | undefined;
  const apiError = typeof body === 'object' && body !== null ? body.error : undefined;
  if (apiError && typeof apiError.code === 'string' && typeof apiError.message === 'string') {
    return new AppError(apiError.code, apiError.message, readFields(apiError.details));
  }

  const { status } = error.response;
  return new AppError(`HTTP_${status}`, `The server answered with an error (${status}). Try again.`);
}

function readFields(details: Record<string, unknown> | undefined): Record<string, string[]> {
  const fields = details?.fields;
  if (typeof fields !== 'object' || fields === null) return {};

  const result: Record<string, string[]> = {};
  for (const [name, messages] of Object.entries(fields)) {
    if (Array.isArray(messages)) {
      result[name] = messages.filter((message): message is string => typeof message === 'string');
    }
  }
  return result;
}
