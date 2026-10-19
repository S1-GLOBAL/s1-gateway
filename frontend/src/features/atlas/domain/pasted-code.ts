/** A code given out before ADR 0025 starts with its format version and a dot: S2, or S1. */
const OLD_CODE_START = /^s[12]\./i;

/** The fewest dots in a code's text: a code has 24, and a name with this many dots also has spaces. */
const FEWEST_DOTS = 3;

/**
 * The code in a search box's text, or null when the text is a name: text that
 * starts with `S2.` or `S1.`, or has no space and at least three dots (ADR
 * 0025), in any case, trimmed and upper-cased, as codes are compared.
 */
export function asPastedCode(text: string): string | null {
  const trimmed = text.trim();
  const isCode = OLD_CODE_START.test(trimmed) || (!/\s/.test(trimmed) && trimmed.split('.').length > FEWEST_DOTS);
  return isCode ? trimmed.toUpperCase() : null;
}
