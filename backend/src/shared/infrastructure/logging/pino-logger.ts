import { pino, type Logger as PinoInstance } from 'pino';
import type { Logger } from '../../application/ports/logger.js';

export function createPino(options: { level: string; pretty: boolean }): PinoInstance {
  return pino({
    level: options.level,
    ...(options.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
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
