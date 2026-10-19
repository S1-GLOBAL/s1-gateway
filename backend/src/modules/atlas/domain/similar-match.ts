import { isNotKnown } from './applicability.js';
import type { SlotKey } from './slots.js';

/** The slots a similar lookup can filter on: every slot but the format version and the variant. */
export const SEARCHABLE_SLOTS = [
  'productType',
  'material',
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
] as const satisfies readonly SlotKey[];

export type SearchableSlotKey = (typeof SEARCHABLE_SLOTS)[number];

/** The raw slot values a lookup asks for. A slot left out is not asked about. */
export type SimilarCriteria = Partial<Record<SearchableSlotKey, string>>;

export function isSearchableSlot(key: string): key is SearchableSlotKey {
  return (SEARCHABLE_SLOTS as readonly string[]).includes(key);
}

/**
 * Where a saved Spec ID stands against what was asked for: `fits` when every
 * chosen slot is equal, `might-fit` when the rest are equal and some are all
 * `0` (not known), `excluded` when any holds a different value. Nothing
 * compares numbers by closeness: `0091` does not fit `0090`.
 */
export function classifyMatch(
  slotOf: (key: SearchableSlotKey) => string,
  criteria: SimilarCriteria,
): 'fits' | 'might-fit' | 'excluded' {
  let unknown = false;
  for (const key of SEARCHABLE_SLOTS) {
    const wanted = criteria[key];
    if (wanted === undefined) continue;
    const actual = slotOf(key);
    if (actual === wanted) continue;
    if (isNotKnown(actual)) unknown = true;
    else return 'excluded';
  }
  return unknown ? 'might-fit' : 'fits';
}
