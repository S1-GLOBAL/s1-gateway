import type { AppError } from '@/shared/application/app-error';

/** Messages the API tied to one of these input names, first match wins. */
export function fieldErrors(error: AppError | null, ...names: string[]): string[] | undefined {
  for (const name of names) {
    const messages = error?.fields[name];
    if (messages && messages.length > 0) return messages;
  }
  return undefined;
}

/** The error's own sentence, unless every message already sits beside an input. */
export function formMessage(error: AppError | null, ...shown: string[]): string | undefined {
  if (!error) return undefined;
  return fieldErrors(error, ...shown) ? undefined : error.message;
}