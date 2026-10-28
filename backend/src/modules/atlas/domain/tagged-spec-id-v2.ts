import type { SlotKey } from './slots.js';

/**
 * V2 of the tagged Spec ID. One letter per slot, in the current slot order.
 * Variant is not written. Empty slots are left out. This is not the format Atlas issues.
 *
 * Capacity is G. The first digit is the unit, and the rest is the amount:
 * 1 ounces, 2 millilitres, 3 servings, 4 count, 5 grams. 12 oz is G112.
 */

export interface V2Letter {
  readonly letter: string;
  readonly slot: SlotKey;
  readonly name: string;
}

export const V2_LETTERS: readonly V2Letter[] = [
  { letter: 'A', slot: 'productType', name: 'Product type' },
  { letter: 'B', slot: 'material', name: 'Material' },
  { letter: 'C', slot: 'coating', name: 'Coating' },
  { letter: 'D', slot: 'colourClarity', name: 'Colour / clarity' },
  { letter: 'E', slot: 'shape', name: 'Shape' },
  { letter: 'F', slot: 'profile', name: 'Profile' },
  { letter: 'G', slot: 'capacity', name: 'Nominal capacity' },
  { letter: 'H', slot: 'topDiameter', name: 'Top diameter' },
  { letter: 'I', slot: 'bottomDiameter', name: 'Bottom diameter' },
  { letter: 'J', slot: 'height', name: 'Height' },
  { letter: 'K', slot: 'length', name: 'Length' },
  { letter: 'L', slot: 'width', name: 'Width' },
  { letter: 'M', slot: 'gusset', name: 'Gusset' },
  { letter: 'N', slot: 'unitWeight', name: 'Unit weight' },
  { letter: 'O', slot: 'basisWeight', name: 'Basis weight' },
  { letter: 'P', slot: 'thickness', name: 'Thickness' },
  { letter: 'Q', slot: 'wall', name: 'Wall' },
  { letter: 'R', slot: 'print', name: 'Print' },
  { letter: 'S', slot: 'compartments', name: 'Compartments' },
  { letter: 'T', slot: 'plies', name: 'Plies' },
  { letter: 'U', slot: 'lidOpening', name: 'Lid opening' },
  { letter: 'V', slot: 'handle', name: 'Handle' },
  { letter: 'W', slot: 'wrap', name: 'Individual wrap' },
  { letter: 'X', slot: 'window', name: 'Window' },
];

/** The first digit of a G value, in the order the capacity units were issued. */
export const V2_CAPACITY_DIGIT_BY_UNIT: Readonly<Record<string, string>> = {
  Z: '1',
  M: '2',
  S: '3',
  N: '4',
  G: '5',
};

export const V2_CAPACITY_UNIT_BY_DIGIT: Readonly<Record<string, string>> = {
  '1': 'Z',
  '2': 'M',
  '3': 'S',
  '4': 'N',
  '5': 'G',
};

export interface V2TagDefinition {
  readonly tag: string;
  readonly slot: SlotKey;
  readonly capacityByDigit?: boolean;
}

export const V2_TAG_DEFINITIONS: readonly V2TagDefinition[] = V2_LETTERS.map((entry) =>
  entry.slot === 'capacity'
    ? { tag: entry.letter, slot: entry.slot, capacityByDigit: true }
    : { tag: entry.letter, slot: entry.slot },
);
