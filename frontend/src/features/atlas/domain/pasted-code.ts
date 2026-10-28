/** A code given out before ADR 0025 starts with its format version and a dot: S2, or S1. */
const OLD_CODE_START = /^s[12]\./i;

/** The fewest dots in a code's text: a code has 24, and a name with this many dots also has spaces. */
const FEWEST_DOTS = 3;

/**
 * A code as written today (plan 0011): every letter, A to X, followed by its
 * number, in any order and either case, with at most one hyphen between the
 * facts and the sizes. Only capacity, G, may have a decimal point.
 */
const CODE = /^(?:[a-fh-x]\d+|g\d+(?:\.\d+)?)+(?:-(?:[a-fh-x]\d+|g\d+(?:\.\d+)?)+)?$/i;

/**
 * The code in a search box's text, or null when the text is a name: text that
 * reads as a code written today (`A5B17-G112`), or a dotted code given out
 * before, which starts with `S2.` or `S1.` or has no space and at least three
 * dots (ADR 0025). In any case, trimmed and upper-cased, as codes are compared.
 */
export function asPastedCode(text: string): string | null {
  const trimmed = text.trim();
  const isDotted =
    OLD_CODE_START.test(trimmed) || (!/\s/.test(trimmed) && trimmed.split('.').length > FEWEST_DOTS);
  return isDotted || CODE.test(trimmed) ? trimmed.toUpperCase() : null;
}
