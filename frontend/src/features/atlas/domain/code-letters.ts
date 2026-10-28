import type { SlotKey } from './atlas';

/**
 * The letter a code writes each fact with (plan 0011): the named facts, then
 * the sizes after the hyphen. The variant is never written.
 */
export const CODE_LETTERS: Readonly<Record<Exclude<SlotKey, 'variant'>, string>> = {
  productType: 'A',
  material: 'B',
  coating: 'C',
  colourClarity: 'D',
  shape: 'E',
  profile: 'F',
  capacity: 'G',
  topDiameter: 'H',
  bottomDiameter: 'I',
  height: 'J',
  length: 'K',
  width: 'L',
  gusset: 'M',
  unitWeight: 'N',
  basisWeight: 'O',
  thickness: 'P',
  wall: 'Q',
  print: 'R',
  compartments: 'S',
  plies: 'T',
  lidOpening: 'U',
  handle: 'V',
  wrap: 'W',
  window: 'X',
};

/** A slot's letter, or undefined for the variant, which a code never writes. */
export function codeLetter(key: SlotKey): string | undefined {
  return key === 'variant' ? undefined : CODE_LETTERS[key];
}

/**
 * How a code writes a dictionary value: its list's letter, then its number.
 * Material 17 is `B17`; a capacity unit is the digit after `G`, so ounces,
 * unit 1, is `G1`.
 */
export function valueCode(key: SlotKey, number: number): string {
  return `${codeLetter(key) ?? ''}${number}`;
}

/** Dictionary values in the order a code numbers them: `A1`, `A2`, … `A10`. */
export function byNumber<T extends { readonly number: number }>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.number - b.number);
}
