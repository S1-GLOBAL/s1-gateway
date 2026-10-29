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

/**
 * The letters a code writes a number with, not a dictionary option: the
 * capacity and each size, after the hyphen, and the counts. What each holds
 * and how its number reads, with an example, so `J60` is known for a 60 mm
 * height.
 */
export const NUMBER_PARTS: readonly { readonly key: SlotKey; readonly unit: string; readonly example: string }[] = [
  { key: 'capacity', unit: "The unit's number from Nominal capacity, then the amount", example: 'G112 is 12 oz, when ounces are unit 1' },
  { key: 'topDiameter', unit: 'Millimetres', example: 'H90 is 90 mm' },
  { key: 'bottomDiameter', unit: 'Millimetres', example: 'I60 is 60 mm' },
  { key: 'height', unit: 'Millimetres', example: 'J110 is 110 mm' },
  { key: 'length', unit: 'Millimetres', example: 'K200 is 200 mm' },
  { key: 'width', unit: 'Millimetres', example: 'L150 is 150 mm' },
  { key: 'gusset', unit: 'Millimetres', example: 'M80 is 80 mm' },
  { key: 'unitWeight', unit: 'Tenths of a gram', example: 'N33 is 3.3 g' },
  { key: 'basisWeight', unit: 'Grams per square metre', example: 'O280 is 280 gsm' },
  { key: 'thickness', unit: 'Micrometres', example: 'P350 is 350 µm' },
  { key: 'compartments', unit: 'A count', example: 'S3 is 3 compartments' },
  { key: 'plies', unit: 'A count', example: 'T2 is 2 plies' },
];

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
