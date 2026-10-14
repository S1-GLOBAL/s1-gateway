import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Logger } from '../ports/logger.js';

/** Test doubles for the shared ports. Never imported by production code. */

export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}

  now(): Date {
    return new Date(this.at);
  }
}

/** Valid version-4 UUIDs, in order, so assertions can name them. */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  next(): string {
    this.count += 1;
    return `00000000-0000-4000-8000-${String(this.count).padStart(12, '0')}`;
  }
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export class RecordingLogger implements Logger {
  readonly errors: { message: string; context?: Record<string, unknown> }[] = [];

  info(): void {}

  warn(): void {}

  error(message: string, context?: Record<string, unknown>): void {
    this.errors.push({ message, context });
  }
}
