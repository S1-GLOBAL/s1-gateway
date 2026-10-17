/** Every Spec ID starts with its format version and a dot. */
const CODE_START = /^s1\./i;

/**
 * The code in a search box's text, or null when the text is a name: text that
 * starts with `S1.` in any case, trimmed and upper-cased, as codes are compared.
 */
export function asPastedCode(text: string): string | null {
  const trimmed = text.trim();
  return CODE_START.test(trimmed) ? trimmed.toUpperCase() : null;
}
