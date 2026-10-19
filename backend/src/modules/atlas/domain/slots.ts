import { fraction, type Fraction } from './measurement.js';

/** The 25 slots of a Spec ID, in the order they appear in the code (ADR 0019, ADR 0024, ADR 0025). */
export type SlotKey =
  | 'productType'
  | 'material'
  | 'coating'
  | 'colourClarity'
  | 'shape'
  | 'profile'
  | 'capacity'
  | 'topDiameter'
  | 'bottomDiameter'
  | 'height'
  | 'length'
  | 'width'
  | 'gusset'
  | 'unitWeight'
  | 'basisWeight'
  | 'thickness'
  | 'wall'
  | 'print'
  | 'compartments'
  | 'plies'
  | 'lidOpening'
  | 'handle'
  | 'wrap'
  | 'window'
  | 'variant';

export type SlotKind = 'dictionary' | 'capacity' | 'measure' | 'count' | 'variant';

export interface SlotDefinition {
  /** 1–25, the slot's place in the code. */
  readonly number: number;
  readonly key: SlotKey;
  /** The name people read, in every message. */
  readonly name: string;
  /** The width of a value. A marker is always one letter, `Y` or `X` (ADR 0025). */
  readonly width: number;
  readonly kind: SlotKind;
}

export const SLOTS: readonly SlotDefinition[] = [
  { number: 1, key: 'productType', name: 'Product type', width: 3, kind: 'dictionary' },
  { number: 2, key: 'material', name: 'Material', width: 3, kind: 'dictionary' },
  { number: 3, key: 'coating', name: 'Coating', width: 2, kind: 'dictionary' },
  { number: 4, key: 'colourClarity', name: 'Colour / clarity', width: 2, kind: 'dictionary' },
  { number: 5, key: 'shape', name: 'Shape', width: 2, kind: 'dictionary' },
  { number: 6, key: 'profile', name: 'Profile', width: 2, kind: 'dictionary' },
  { number: 7, key: 'capacity', name: 'Nominal capacity', width: 5, kind: 'capacity' },
  { number: 8, key: 'topDiameter', name: 'Top diameter', width: 4, kind: 'measure' },
  { number: 9, key: 'bottomDiameter', name: 'Bottom diameter', width: 4, kind: 'measure' },
  { number: 10, key: 'height', name: 'Height', width: 4, kind: 'measure' },
  { number: 11, key: 'length', name: 'Length', width: 4, kind: 'measure' },
  { number: 12, key: 'width', name: 'Width', width: 4, kind: 'measure' },
  { number: 13, key: 'gusset', name: 'Gusset', width: 4, kind: 'measure' },
  { number: 14, key: 'unitWeight', name: 'Unit weight', width: 4, kind: 'measure' },
  { number: 15, key: 'basisWeight', name: 'Basis weight', width: 3, kind: 'measure' },
  { number: 16, key: 'thickness', name: 'Thickness', width: 3, kind: 'measure' },
  { number: 17, key: 'wall', name: 'Wall', width: 2, kind: 'dictionary' },
  { number: 18, key: 'print', name: 'Print', width: 2, kind: 'dictionary' },
  { number: 19, key: 'compartments', name: 'Compartments', width: 2, kind: 'count' },
  { number: 20, key: 'plies', name: 'Plies', width: 1, kind: 'count' },
  { number: 21, key: 'lidOpening', name: 'Lid opening', width: 2, kind: 'dictionary' },
  { number: 22, key: 'handle', name: 'Handle', width: 2, kind: 'dictionary' },
  { number: 23, key: 'wrap', name: 'Individual wrap', width: 2, kind: 'dictionary' },
  { number: 24, key: 'window', name: 'Window', width: 2, kind: 'dictionary' },
  { number: 25, key: 'variant', name: 'Variant number', width: 2, kind: 'variant' },
];

export const SLOT_COUNT = 25;
/** A slot the product has, though no source states it (ADR 0025). */
export const NOT_KNOWN = 'Y';
/** A slot this product never has (ADR 0025). */
export const DOES_NOT_APPLY = 'X';
/** Variants are out of scope: every code ends in `X`. */
export const NO_VARIANT = DOES_NOT_APPLY;
/** `round_only` slots apply when the shape is this code; `non_round_only` when it is any other. */
export const ROUND_SHAPE = 'RD';
/** `paper_only` slots apply when the material's first letter (its family) is this one. */
export const PAPER_FAMILY = 'B';
/** The dictionary release this build issues codes under. */
export const CURRENT_RELEASE = 'S2 0.1.0';

/** Slots whose values come from the dictionary. `capacity` holds its unit letter there. */
export type DictionarySlotKey =
  | 'productType'
  | 'material'
  | 'coating'
  | 'colourClarity'
  | 'shape'
  | 'profile'
  | 'capacity'
  | 'wall'
  | 'print'
  | 'lidOpening'
  | 'handle'
  | 'wrap'
  | 'window';

export const DICTIONARY_SLOTS: readonly DictionarySlotKey[] = [
  'productType',
  'material',
  'coating',
  'colourClarity',
  'shape',
  'profile',
  'capacity',
  'wall',
  'print',
  'lidOpening',
  'handle',
  'wrap',
  'window',
];

/**
 * Slots whose applicability the dictionary decides, per product type. Product
 * type, material and variant are in every code.
 */
export type RuledSlotKey = Exclude<SlotKey, 'productType' | 'material' | 'variant'>;

export const RULED_SLOTS: readonly RuledSlotKey[] = [
  'coating',
  'colourClarity',
  'shape',
  'profile',
  'capacity',
  'topDiameter',
  'bottomDiameter',
  'height',
  'length',
  'width',
  'gusset',
  'unitWeight',
  'basisWeight',
  'thickness',
  'wall',
  'print',
  'compartments',
  'plies',
  'lidOpening',
  'handle',
  'wrap',
  'window',
];

export type SlotRule = 'applies' | 'never' | 'round_only' | 'non_round_only' | 'paper_only';

export const SLOT_RULES: readonly SlotRule[] = ['applies', 'never', 'round_only', 'non_round_only', 'paper_only'];

export type MeasureSlotKey =
  | 'topDiameter'
  | 'bottomDiameter'
  | 'height'
  | 'length'
  | 'width'
  | 'gusset'
  | 'unitWeight'
  | 'basisWeight'
  | 'thickness';

export interface MeasureDefinition {
  /** Each accepted unit, and the exact factor that turns one of it into the slot's step. */
  readonly units: Readonly<Record<string, Fraction>>;
  /** The accepted units, as a message lists them. */
  readonly unitsText: string;
  /** The largest whole number of steps; the smallest is always 1. */
  readonly max: bigint;
  /** `{min}–{max} {unit}` in the out-of-range message. */
  readonly rangeText: string;
}

const DIMENSION: MeasureDefinition = {
  units: { mm: fraction(1n, 1n), cm: fraction(10n, 1n), in: fraction(254n, 10n) },
  unitsText: 'mm, cm or in',
  max: 9999n,
  rangeText: '1–9999 mm',
};

export const MEASURES: Readonly<Record<MeasureSlotKey, MeasureDefinition>> = {
  topDiameter: DIMENSION,
  bottomDiameter: DIMENSION,
  height: DIMENSION,
  length: DIMENSION,
  width: DIMENSION,
  gusset: DIMENSION,
  // The slot counts tenths of a gram, so one gram is ten steps.
  unitWeight: { units: { g: fraction(10n, 1n) }, unitsText: 'g', max: 9999n, rangeText: '0.1–999.9 g' },
  basisWeight: { units: { gsm: fraction(1n, 1n) }, unitsText: 'gsm', max: 999n, rangeText: '1–999 gsm' },
  thickness: { units: { um: fraction(1n, 1n) }, unitsText: 'µm', max: 999n, rangeText: '1–999 µm' },
};

/** How a measurement's unit is written in a message: the API's `um` reads as `µm`. */
export const UNIT_LABELS: Readonly<Record<string, string>> = {
  mm: 'mm',
  cm: 'cm',
  in: 'in',
  g: 'g',
  gsm: 'gsm',
  um: 'µm',
};

/** How a capacity's unit letter is written after a number: `6 oz`, `500 mL`. */
export const CAPACITY_UNIT_LABELS: Readonly<Record<string, string>> = {
  Z: 'oz',
  M: 'mL',
  S: 'servings',
  N: 'count',
  G: 'g',
};

export const CAPACITY_MAX = 9999n;

/** Slots that hold a count: a whole number, padded to the slot's width. */
export type CountSlotKey = 'compartments' | 'plies';

export interface CountDefinition {
  /** The largest count; the smallest is always 1. */
  readonly max: number;
  /** One of it, and more than one, after a number: `1 compartment`, `3 compartments`. */
  readonly one: string;
  readonly many: string;
}

export const COUNTS: Readonly<Record<CountSlotKey, CountDefinition>> = {
  compartments: { max: 12, one: 'compartment', many: 'compartments' },
  plies: { max: 4, one: 'ply', many: 'plies' },
};

export function slotDefinition(key: SlotKey): SlotDefinition {
  const definition = SLOTS.find((slot) => slot.key === key);
  if (!definition) throw new Error(`Unknown slot ${key}`);
  return definition;
}
