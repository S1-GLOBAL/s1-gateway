import { Dictionary, type DictionaryValue, type SlotRuleEntry } from '../dictionary.js';
import type { RuledSlotKey, SlotRule } from '../slots.js';

/*
 * Release S1 0.1.0 exactly as the seed migration loads it
 * (backend/drizzle/0003_seed_atlas_dictionary_s1_0_1_0.sql). For tests only;
 * the repository test proves the database holds the same.
 */

export const S1_0_1_0_VALUES: readonly DictionaryValue[] = [
  { slot: 'productType', code: 'BLD', meaning: 'Bowl lid' },
  { slot: 'productType', code: 'CLD', meaning: 'Cup lid' },
  { slot: 'productType', code: 'BWL', meaning: 'Bowl' },
  { slot: 'productType', code: 'SUP', meaning: 'Stand-up pouch' },
  { slot: 'material', code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
  { slot: 'material', code: 'APT', meaning: 'Polymer, PET' },
  { slot: 'material', code: 'B00', meaning: 'Paper and paperboard, grade not known' },
  { slot: 'material', code: 'BKR', meaning: 'Paper and paperboard, kraft' },
  { slot: 'coating', code: 'NC', meaning: 'No coating, as stated by the source' },
  { slot: 'coating', code: 'PI', meaning: 'PE inside only' },
  { slot: 'coating', code: 'PO', meaning: 'PE outside only' },
  { slot: 'coating', code: 'PB', meaning: 'PE both sides' },
  { slot: 'colourClarity', code: 'CL', meaning: 'Clear' },
  { slot: 'colourClarity', code: 'TL', meaning: 'Translucent' },
  { slot: 'colourClarity', code: 'WH', meaning: 'White' },
  { slot: 'colourClarity', code: 'BR', meaning: 'Brown' },
  { slot: 'shape', code: 'RD', meaning: 'Round' },
  { slot: 'shape', code: 'SQ', meaning: 'Square' },
  { slot: 'shape', code: 'RC', meaning: 'Rectangular' },
  { slot: 'shape', code: 'OV', meaning: 'Oval' },
  { slot: 'profile', code: 'DM', meaning: 'Dome' },
  { slot: 'profile', code: 'HD', meaning: 'Half dome' },
  { slot: 'profile', code: 'FL', meaning: 'Flat' },
  { slot: 'capacity', code: 'Z', meaning: 'Ounces, nominal trade size' },
  { slot: 'capacity', code: 'M', meaning: 'Millilitres' },
  { slot: 'capacity', code: 'S', meaning: 'Servings' },
  { slot: 'capacity', code: 'N', meaning: 'Count' },
  { slot: 'capacity', code: 'G', meaning: 'Grams' },
];

/** The "Which slots apply" table: one rule per ruled slot S1 had, per product type. */
const TABLE: Readonly<Record<string, Readonly<Partial<Record<RuledSlotKey, SlotRule>>>>> = {
  BLD: {
    coating: 'applies',
    colourClarity: 'applies',
    shape: 'applies',
    profile: 'applies',
    capacity: 'never',
    topDiameter: 'round_only',
    bottomDiameter: 'never',
    height: 'applies',
    length: 'non_round_only',
    width: 'non_round_only',
    gusset: 'never',
    unitWeight: 'applies',
    basisWeight: 'paper_only',
    thickness: 'applies',
  },
  CLD: {
    coating: 'applies',
    colourClarity: 'applies',
    shape: 'applies',
    profile: 'applies',
    capacity: 'never',
    topDiameter: 'round_only',
    bottomDiameter: 'never',
    height: 'applies',
    length: 'non_round_only',
    width: 'non_round_only',
    gusset: 'never',
    unitWeight: 'applies',
    basisWeight: 'paper_only',
    thickness: 'applies',
  },
  BWL: {
    coating: 'applies',
    colourClarity: 'applies',
    shape: 'applies',
    profile: 'never',
    capacity: 'applies',
    topDiameter: 'round_only',
    bottomDiameter: 'round_only',
    height: 'applies',
    length: 'non_round_only',
    width: 'non_round_only',
    gusset: 'never',
    unitWeight: 'applies',
    basisWeight: 'paper_only',
    thickness: 'applies',
  },
  SUP: {
    coating: 'applies',
    colourClarity: 'applies',
    shape: 'never',
    profile: 'never',
    capacity: 'applies',
    topDiameter: 'never',
    bottomDiameter: 'never',
    height: 'applies',
    length: 'never',
    width: 'applies',
    gusset: 'applies',
    unitWeight: 'applies',
    basisWeight: 'applies',
    thickness: 'applies',
  },
};

export const S1_0_1_0_RULES: readonly SlotRuleEntry[] = Object.entries(TABLE).flatMap(([productType, rules]) =>
  Object.entries(rules).map(([slot, rule]) => ({ productType, slot: slot as RuledSlotKey, rule: rule as SlotRule })),
);

export function s1Dictionary(): Dictionary {
  return new Dictionary('S1 0.1.0', '2026-10-16', S1_0_1_0_VALUES, S1_0_1_0_RULES);
}
