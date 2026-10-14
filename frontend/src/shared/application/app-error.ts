/**
 * Every failed request, normalised. A component shows `message`, and
 * `fields[name]` next to an input, without knowing whether the cause was a
 * timeout, no connection, or a rule the server enforced.
 */
export class AppError extends Error {
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }
}
