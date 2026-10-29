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
 * Materials that name a family, in S2 0.1.0's letters, each with the letters
 * its grades begin with: plastic, paper, molded fibre and metal of unknown
 * grade, and kraft, a family of paper grades.
 */
const MATERIAL_FAMILIES: Readonly<Record<string, string>> = { A00: 'A', B00: 'B', C00: 'C', D00: 'D', BKR: 'BK' };

/** Each family material as `dictionary` writes it now, with the letters its grades begin with. */
export type MaterialFamilies = ReadonlyMap<string, string>;

export function materialFamiliesIn(dictionary: Dictionary): MaterialFamilies {
  const families = new Map<string, string>();
  for (const [code, prefix] of Object.entries(MATERIAL_FAMILIES)) {
    const live = dictionary.liveOriginal('material', code);
    if (live !== undefined) families.set(live, prefix);
  }
  return families;
}

/**
 * How a saved material stands to the one asked for: `equal` when it is that
 * material, or a grade of the family asked for ("paper" asked, "recycled
 * kraft" saved); `family` when it records only the family of the grade asked
 * for ("recycled kraft" asked, "paper" saved); else `other`.
 */
function materialStanding(wanted: string, actual: string, families: MaterialFamilies): 'equal' | 'family' | 'other' {
  if (actual === wanted) return 'equal';
  const asked = families.get(wanted);
  if (asked !== undefined && actual.startsWith(asked)) return 'equal';
  const recorded = families.get(actual);
  if (recorded !== undefined && wanted.startsWith(recorded)) return 'family';
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
  families: MaterialFamilies = new Map(),
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
  families: MaterialFamilies = new Map(),
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
