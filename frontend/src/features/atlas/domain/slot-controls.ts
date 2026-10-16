import type { SlotKey } from './atlas';

/** The dictionary slots, besides product type and capacity, a form offers as a choice of codes. */
export type CodeSlotKey = 'material' | 'coating' | 'colourClarity' | 'shape' | 'profile';

export const CODE_SLOTS: readonly CodeSlotKey[] = ['material', 'coating', 'colourClarity', 'shape', 'profile'];

export type MeasuredSlotKey =
  | 'topDiameter'
  | 'bottomDiameter'
  | 'height'
  | 'length'
  | 'width'
  | 'gusset'
  | 'unitWeight'
  | 'basisWeight'
  | 'thickness';

export interface MeasureUnit {
  /** What the API takes: `um` for micrometres. */
  value: string;
  /** What people read: `µm`. */
  label: string;
}

export interface MeasuredSlot {
  key: MeasuredSlotKey;
  /** The first is the default. The slot's own unit, the one its code counts in, comes first. */
  units: readonly MeasureUnit[];
  /** The number of characters the slot has in a code. */
  width: number;
}

const DIMENSION_UNITS: readonly MeasureUnit[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'in' },
];

/** Every measured slot, in code order, with the units a person may type it in. */
export const MEASURED_SLOTS: readonly MeasuredSlot[] = [
  { key: 'topDiameter', units: DIMENSION_UNITS, width: 4 },
  { key: 'bottomDiameter', units: DIMENSION_UNITS, width: 4 },
  { key: 'height', units: DIMENSION_UNITS, width: 4 },
  { key: 'length', units: DIMENSION_UNITS, width: 4 },
  { key: 'width', units: DIMENSION_UNITS, width: 4 },
  { key: 'gusset', units: DIMENSION_UNITS, width: 4 },
  { key: 'unitWeight', units: [{ value: 'g', label: 'g' }], width: 4 },
  { key: 'basisWeight', units: [{ value: 'gsm', label: 'gsm' }], width: 3 },
  { key: 'thickness', units: [{ value: 'um', label: 'µm' }], width: 3 },
];

export function isMeasuredSlot(key: SlotKey): key is MeasuredSlotKey {
  return MEASURED_SLOTS.some((slot) => slot.key === key);
}
