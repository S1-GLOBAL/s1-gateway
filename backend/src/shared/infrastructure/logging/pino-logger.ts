import { pino, type DestinationStream, type Logger as PinoInstance, type LoggerOptions } from 'pino';
import type { Logger } from '../../application/ports/logger.js';

/**
 * Credentials a request or response carries in its headers, as the request
 * logger writes them. Never logged: the session token in a cookie lets anyone
 * who reads the logs act as that staff member, and the database keeps only
 * its hash for that reason. Client IPs stay, for tracing and debugging.
 */
const CREDENTIAL_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-vercel-proxy-signature"]',
  'res.headers["set-cookie"]',
];

/** `destination` is for tests; the API writes to stdout. */
export function createPino(
  options: { level: string; pretty: boolean },
  destination?: DestinationStream,
): PinoInstance {
  const settings: LoggerOptions = {
    level: options.level,
    redact: { paths: CREDENTIAL_PATHS, censor: '[Redacted]' },
    ...(options.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
  return destination ? pino(settings, destination) : pino(settings);
}

/** Adapts Pino to the application's Logger port. */
export class PinoLogger implements Logger {
  constructor(private readonly pino: PinoInstance) {}

  info(message: string, context: Record<string, unknown> = {}): void {
    this.pino.info(context, message);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.pino.warn(context, message);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.pino.error(context, message);
  }
}
