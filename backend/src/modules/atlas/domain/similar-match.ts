import { isNotKnown } from './applicability.js';
import type { Dictionary } from './dictionary.js';
import type { SlotKey } from './slots.js';

/** The slots a similar lookup can filter on: every slot but the variant. */
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
 * Whether one material is a grade of another: recycled kraft of kraft, and of
 * paper of unknown grade (ADR 0033). A material is no grade of itself.
 */
export type MaterialFamilies = (grade: string, family: string) => boolean;

const NO_FAMILIES: MaterialFamilies = () => false;

/** The grades `dictionary` says each material has, through every broader material. */
export function materialFamiliesIn(dictionary: Dictionary): MaterialFamilies {
  return (grade, family) => grade !== family && dictionary.isGradeOf(grade, family);
}

/**
 * How a saved material stands to the one asked for: `equal` when it is that
 * material, or a grade of the family asked for ("paper" asked, "recycled
 * kraft" saved); `family` when it records only the family of the grade asked
 * for ("recycled kraft" asked, "paper" saved); else `other`.
 */
function materialStanding(wanted: string, actual: string, families: MaterialFamilies): 'equal' | 'family' | 'other' {
  if (actual === wanted || families(actual, wanted)) return 'equal';
  if (families(wanted, actual)) return 'family';
  return 'other';
}

/**
 * Where a saved Spec ID stands against what was asked for: `fits` when every
 * chosen slot is equal, `might-fit` when the rest are equal and some are all
 * `0` (not known), `excluded` when any holds a different value. A material
 * family fits each of its grades, and a grade might fit a Spec ID that
 * records only its family. Nothing compares numbers by closeness: `0091`
 * does not fit `0090`.
 */
export function classifyMatch(
  slotOf: (key: SearchableSlotKey) => string,
  criteria: SimilarCriteria,
  families: MaterialFamilies = NO_FAMILIES,
): 'fits' | 'might-fit' | 'excluded' {
  let unknown = false;
  for (const key of SEARCHABLE_SLOTS) {
    const wanted = criteria[key];
    if (wanted === undefined) continue;
    const actual = slotOf(key);
    if (actual === wanted) continue;
    if (key === 'material') {
      const standing = materialStanding(wanted, actual, families);
      if (standing === 'equal') continue;
      if (standing === 'family') {
        unknown = true;
        continue;
      }
    }
    if (isNotKnown(actual)) unknown = true;
    else return 'excluded';
  }
  return unknown ? 'might-fit' : 'fits';
}

/** How many of the chosen slots a saved Spec ID records: equal to the value asked for, or a grade of the family asked for, not merely not known. */
export function recordedCount(
  slotOf: (key: SearchableSlotKey) => string,
  criteria: SimilarCriteria,
  families: MaterialFamilies = NO_FAMILIES,
): number {
  return SEARCHABLE_SLOTS.filter((key) => {
    const wanted = criteria[key];
    if (wanted === undefined) return false;
    return key === 'material' ? materialStanding(wanted, slotOf(key), families) === 'equal' : slotOf(key) === wanted;
  }).length;
}

/** How many of a saved Spec ID's slots are not known (`Y`). A slot that does not apply (`X`) is not counted. */
export function notKnownCount(slotOf: (key: SearchableSlotKey) => string): number {
  return SEARCHABLE_SLOTS.filter((key) => isNotKnown(slotOf(key))).length;
}
