import type { Response } from 'express';
import type { ApiErrorBody, DataEnvelope } from '../../../contracts/envelope.js';

export function sendData<T>(res: Response, status: number, data: T): void {
  const body: DataEnvelope<T> = { data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  res.status(status).json(body);
}
