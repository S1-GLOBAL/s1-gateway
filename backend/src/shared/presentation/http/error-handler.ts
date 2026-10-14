import type { ErrorRequestHandler } from 'express';
import type { Logger } from '../../application/ports/logger.js';
import { HttpError } from './http-error.js';
import { sendError } from './respond.js';

interface KnownFailure {
  status: number;
  code: string;
  message: string;
}

/**
 * Express's body parser marks a body it could not read with a `type`, and
 * every such failure with `expose: true` and a 4xx `status`. All of them are
 * the client's mistake, never a bug, so each gets its own status rather than
 * a 500.
 */
function bodyParserFailure(error: unknown): KnownFailure | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) return null;
  if (error.type === 'entity.parse.failed') {
    return { status: 400, code: 'MALFORMED_JSON', message: 'The request body is not valid JSON.' };
  }
  if (error.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' };
  }

  const status = 'status' in error ? error.status : undefined;
  const exposed = 'expose' in error && error.expose === true;
  if (!exposed || typeof status !== 'number' || status < 400 || status > 499) return null;
  if (status === 415) {
    return {
      status,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The request body is in an encoding or character set the server does not accept.',
    };
  }
  return { status, code: 'BAD_REQUEST', message: 'The request body could not be read.' };
}

/**
 * The only place an error becomes a response, so the client sees exactly one
 * error shape. Anything unrecognised is a bug: logged in full, answered with a
 * generic 500 that leaks nothing.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      sendError(res, error.status, error.code, error.message, error.details);
      return;
    }

    const failure = bodyParserFailure(error);
    if (failure) {
      sendError(res, failure.status, failure.code, failure.message);
      return;
    }

    logger.error('Unhandled error', { err: error });
    sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again later.');
  };
}
