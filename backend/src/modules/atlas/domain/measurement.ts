/**
 * Exact decimal arithmetic for the measured slots (ADR 0019). A measurement
 * never becomes a JavaScript number: its decimal text is read into a whole
 * numerator over a power of ten, multiplied by the unit's exact factor, and
 * rounded half up to the slot's step. 1.375 in is 1375/1000 × 254/10 =
 * 34.925 mm, which rounds to 35.
 */

export const MAX_DECIMAL_PLACES = 6;

/** A non-negative rational number. Never reduced; only ever rounded. */
export interface Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type DecimalReading =
  | { readonly ok: true; readonly value: Fraction }
  | { readonly ok: false; readonly reason: 'not-a-number' | 'too-many-decimals' };

/** Digits, optionally a point and more digits. No sign, exponent, comma or bare point. */
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

export function fraction(numerator: bigint, denominator: bigint): Fraction {
  return { numerator, denominator };
}

/** Reads `"1.375"` as 1375/1000. Surrounding spaces are ignored. */
export function readDecimal(text: string): DecimalReading {
  const match = DECIMAL.exec(text.trim());
  if (!match) return { ok: false, reason: 'not-a-number' };
  const whole = match[1] ?? '';
  const decimals = match[2] ?? '';
  if (decimals.length > MAX_DECIMAL_PLACES) return { ok: false, reason: 'too-many-decimals' };
  return {
    ok: true,
    value: fraction(BigInt(whole + decimals), 10n ** BigInt(decimals.length)),
  };
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

/** The nearest whole number, a half going up: 34.925 → 35, 107.95 → 108, 0.4 → 0. */
export function roundHalfUp(value: Fraction): bigint {
  return (2n * value.numerator + value.denominator) / (2n * value.denominator);
}
