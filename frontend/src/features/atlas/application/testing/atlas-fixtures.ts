import type { AtlasGateway } from '../atlas-gateway';
import {
  SLOT_NAMES,
  type AtlasDictionary,
  type DecodedSpecId,
  type SavedSpecId,
  type SlotKey,
  type SlotRule,
  type SlotRuleEntry,
  type SpecIdLookup,
} from '../../domain/atlas';
import { codeLetter } from '../../domain/code-letters';

/** Test doubles for the Atlas feature. Never imported by production code. */

/**
 * The specification's illustrative bowl lid, slot by slot, as the dotted code
 * it was given out as. Every other value in the tests is invented.
 */
export const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

/** The same bowl lid as a code is written today: a letter and a number per known fact. */
export const ILLUSTRATIVE_V2 = 'A1B4D1E1F1-H90N33';

/** `code` with one slot's text replaced: `withSlot(ILLUSTRATIVE, 'height', '0062')`. */
export function withSlot(code: string, key: SlotKey, raw: string): string {
  const parts = code.split('.');
  parts[SLOT_NAMES.findIndex((slot) => slot.key === key)] = raw;
  return parts.join('.');
}

const RULED_ORDER: readonly SlotKey[] = [
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
];

function rulesFor(productType: string, rules: readonly SlotRule[]): SlotRuleEntry[] {
  return RULED_ORDER.map((slot, index) => ({ productType, slot, rule: rules[index] ?? 'applies' }));
}

/** A small dictionary: two product types, with the rules the illustrative lid follows. */
export const testDictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-16',
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', number: 1 },
        { code: 'BWL', meaning: 'Bowl', number: 3 },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', number: 4 },
        { code: 'BPA', meaning: 'Paper, plain', number: 35 },
      ],
    },
    { key: 'coating', name: 'Coating', values: [{ code: 'PE', meaning: 'Polyethylene', number: 12 }] },
    { key: 'colourClarity', name: 'Colour / clarity', values: [{ code: 'CL', meaning: 'Clear', number: 1 }] },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', number: 1 },
        { code: 'SQ', meaning: 'Square', number: 2 },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', number: 1 }] },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'Z', meaning: 'Ounces', number: 1 },
        { code: 'M', meaning: 'Millilitres', number: 2 },
      ],
    },
  ],
  rules: [
    ...rulesFor('BLD', [
      'applies',
      'applies',
      'applies',
      'applies',
      'never',
      'round_only',
      'never',
      'applies',
      'non_round_only',
      'non_round_only',
      'never',
      'applies',
      'paper_only',
      'applies',
    ]),
    ...rulesFor('BWL', [
      'applies',
      'applies',
      'applies',
      'never',
      'applies',
      'round_only',
      'applies',
      'applies',
      'non_round_only',
      'non_round_only',
      'never',
      'applies',
      'paper_only',
      'applies',
    ]),
  ],
};

/**
 * The 25 slots of the dotted `code`, each meaning just the raw text, except
 * the product type, and each written as a code writes it today: `BLD` is `A1`,
 * `0090` is `H90`.
 */
export function decodedFor(code: string): DecodedSpecId {
  const parts = code.split('.');
  return {
    code,
    dictionaryRelease: 'S2 0.1.0',
    slots: SLOT_NAMES.map((slot, index) => {
      const raw = parts[index] ?? '';
      return {
        number: index + 1,
        key: slot.key,
        name: slot.name,
        raw,
        part: partOf(slot.key, raw),
        state: 'value' as const,
        meaning: slot.key === 'productType' ? 'Bowl lid' : raw,
      };
    }),
  };
}

/** How a code written today writes a slot's raw text, numbered as in `s2Dictionary`; empty when left out. */
function partOf(key: SlotKey, raw: string): string {
  const letter = codeLetter(key);
  if (letter === undefined || raw === '' || raw === 'Y' || raw === 'X') return '';
  const numberOf = (slotKey: SlotKey, code: string) =>
    s2Dictionary.slots.find((slot) => slot.key === slotKey)?.values.find((value) => value.code === code)?.number;
  if (key === 'capacity') return `${letter}${numberOf('capacity', raw.slice(0, 1)) ?? ''}${trimZeros(raw.slice(1))}`;
  if (/^[\d.]+$/.test(raw)) return `${letter}${trimZeros(raw)}`;
  return `${letter}${numberOf(key, raw) ?? raw}`;
}

/** `0090` → `90`. */
function trimZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}

/**
 * The 25 slots of `code`, each in the state its text shows: `Y` not
 * known, `X` doesn't apply, anything else a value meaning just its text,
 * as in `decodedFor`.
 */
export function readCode(code: string): DecodedSpecId {
  const decoded = decodedFor(code);
  return {
    ...decoded,
    slots: decoded.slots.map((slot) => {
      if (slot.raw === 'Y') return { ...slot, state: 'not-known' as const, meaning: 'Not known' };
      if (slot.raw === 'X') return { ...slot, state: 'does-not-apply' as const, meaning: "Doesn't apply" };
      return slot;
    }),
  };
}

/**
 * The S1 0.1.0 product types and rules, as `0003_seed_atlas_dictionary_s1_0_1_0.sql`
 * seeds them, with only some of its materials, shapes, profiles and capacity units.
 */
export const s1Dictionary: AtlasDictionary = {
  release: 'S1 0.1.0',
  approvedOn: '2026-10-16',
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', number: 1 },
        { code: 'CLD', meaning: 'Cup lid', number: 2 },
        { code: 'BWL', meaning: 'Bowl', number: 3 },
        { code: 'SUP', meaning: 'Stand-up pouch', number: 4 },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', number: 4 },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', number: 12 },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', number: 1 },
        { code: 'SQ', meaning: 'Square', number: 2 },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', number: 1 }] },
    { key: 'capacity', name: 'Nominal capacity', values: [{ code: 'Z', meaning: 'Ounces, nominal trade size', number: 1 }] },
  ],
  rules: [
    ...rulesFor('BLD', [
      'applies',
      'applies',
      'applies',
      'applies',
      'never',
      'round_only',
      'never',
      'applies',
      'non_round_only',
      'non_round_only',
      'never',
      'applies',
      'paper_only',
      'applies',
    ]),
    ...rulesFor('CLD', [
      'applies',
      'applies',
      'applies',
      'applies',
      'never',
      'round_only',
      'never',
      'applies',
      'non_round_only',
      'non_round_only',
      'never',
      'applies',
      'paper_only',
      'applies',
    ]),
    ...rulesFor('BWL', [
      'applies',
      'applies',
      'applies',
      'never',
      'applies',
      'round_only',
      'round_only',
      'applies',
      'non_round_only',
      'non_round_only',
      'never',
      'applies',
      'paper_only',
      'applies',
    ]),
    ...rulesFor('SUP', [
      'applies',
      'applies',
      'never',
      'never',
      'applies',
      'never',
      'never',
      'applies',
      'never',
      'applies',
      'applies',
      'applies',
      'applies',
      'applies',
    ]),
  ],
};

/** The 22 slots S2 0.1.0 has a rule for, in code order. */
const S2_RULED_ORDER: readonly SlotKey[] = [
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

/** Each product type's rules, in `S2_RULED_ORDER`. */
const S2_RULES: Record<string, readonly SlotRule[]> = {
  BAG: ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'applies', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'applies'],
  BLD: ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  BWL: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  CCR: ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  CKT: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  CLD: ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  CTL: ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  CTN: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  CUP: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  CWL: ['applies', 'applies', 'applies', 'applies', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  FCB: ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies'],
  FLM: ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  FRC: ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  FRK: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  HCT: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  KNF: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  LBL: ['applies', 'applies', 'applies', 'never', 'never', 'round_only', 'never', 'never', 'non_round_only', 'non_round_only', 'never', 'never', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  NPK: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never'],
  PAN: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  PCL: ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  PCP: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  PLT: ['applies', 'applies', 'applies', 'never', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  RSC: ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  SCH: ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  SPN: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  STR: ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'never', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  STW: ['never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  SUP: ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'applies', 'applies', 'applies', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies'],
  TKB: ['applies', 'applies', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'applies'],
  TRY: ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  WRP: ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
};

/**
 * Release S2 0.1.0 as the API sends it: every value of
 * `0010_seed_atlas_dictionary_s2_0_1_0.sql`, each slot's values in code order,
 * and every rule, by product type code.
 */
export const s2Dictionary: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BAG', meaning: 'Bag', number: 16 },
        { code: 'BLD', meaning: 'Bowl lid', number: 1 },
        { code: 'BWL', meaning: 'Bowl', number: 3 },
        { code: 'CCR', meaning: 'Cup carrier', number: 23 },
        { code: 'CKT', meaning: 'Cutlery kit', number: 29 },
        { code: 'CLD', meaning: 'Cup lid', number: 2 },
        { code: 'CTL', meaning: 'Container lid', number: 9 },
        { code: 'CTN', meaning: 'Container', number: 8 },
        { code: 'CUP', meaning: 'Cup', number: 5 },
        { code: 'CWL', meaning: 'Container with lid', number: 10 },
        { code: 'FCB', meaning: 'Folding carton', number: 14 },
        { code: 'FLM', meaning: 'Film or roll', number: 19 },
        { code: 'FRC', meaning: 'Fry carton', number: 13 },
        { code: 'FRK', meaning: 'Fork', number: 26 },
        { code: 'HCT', meaning: 'Hinged container (clamshell)', number: 11 },
        { code: 'KNF', meaning: 'Knife', number: 27 },
        { code: 'LBL', meaning: 'Label', number: 31 },
        { code: 'NPK', meaning: 'Napkin', number: 17 },
        { code: 'PAN', meaning: 'Pan', number: 22 },
        { code: 'PCL', meaning: 'Portion cup lid', number: 7 },
        { code: 'PCP', meaning: 'Portion cup', number: 6 },
        { code: 'PLT', meaning: 'Plate', number: 20 },
        { code: 'RSC', meaning: 'Shipping box (RSC)', number: 15 },
        { code: 'SCH', meaning: 'Sachet', number: 30 },
        { code: 'SPN', meaning: 'Spoon', number: 28 },
        { code: 'STR', meaning: 'Stirrer', number: 25 },
        { code: 'STW', meaning: 'Straw', number: 24 },
        { code: 'SUP', meaning: 'Stand-up pouch', number: 4 },
        { code: 'TKB', meaning: 'Takeout box', number: 12 },
        { code: 'TRY', meaning: 'Tray', number: 21 },
        { code: 'WRP', meaning: 'Wrap or sheet', number: 18 },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'A00', meaning: 'Polymer, grade not known', number: 11 },
        { code: 'AEP', meaning: 'Polymer, EPS foam', number: 5 },
        { code: 'AHD', meaning: 'Polymer, HDPE', number: 6 },
        { code: 'ALD', meaning: 'Polymer, LDPE', number: 7 },
        { code: 'ALL', meaning: 'Polymer, LLDPE', number: 8 },
        { code: 'APL', meaning: 'Polymer, PLA', number: 9 },
        { code: 'APM', meaning: 'Polymer, PSM (starch blend)', number: 10 },
        { code: 'APP', meaning: 'Polymer, PP', number: 3 },
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', number: 4 },
        { code: 'APT', meaning: 'Polymer, PET', number: 1 },
        { code: 'ARP', meaning: 'Polymer, rPET', number: 2 },
        { code: 'B00', meaning: 'Paper and paperboard, grade not known', number: 24 },
        { code: 'BCB', meaning: 'Paper and paperboard, corrugated', number: 19 },
        { code: 'BCS', meaning: 'Paper and paperboard, cup stock', number: 17 },
        { code: 'BGP', meaning: 'Paper and paperboard, greaseproof', number: 20 },
        { code: 'BKB', meaning: 'Paper and paperboard, brown kraft', number: 13 },
        { code: 'BKC', meaning: 'Paper and paperboard, recycled kraft', number: 16 },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', number: 12 },
        { code: 'BKV', meaning: 'Paper and paperboard, virgin kraft', number: 15 },
        { code: 'BKW', meaning: 'Paper and paperboard, white kraft', number: 14 },
        { code: 'BSB', meaning: 'Paper and paperboard, SBS', number: 18 },
        { code: 'BSG', meaning: 'Paper and paperboard, semi-gloss', number: 23 },
        { code: 'BTS', meaning: 'Paper and paperboard, tissue', number: 21 },
        { code: 'BWP', meaning: 'Paper and paperboard, wax paper', number: 22 },
        { code: 'C00', meaning: 'Molded fibre, grade not known', number: 29 },
        { code: 'CBG', meaning: 'Molded fibre, bagasse', number: 25 },
        { code: 'CBM', meaning: 'Molded fibre, bamboo', number: 26 },
        { code: 'CGR', meaning: 'Molded fibre, grass', number: 27 },
        { code: 'CSW', meaning: 'Molded fibre, seaweed', number: 28 },
        { code: 'D00', meaning: 'Metal, grade not known', number: 31 },
        { code: 'DAL', meaning: 'Metal, aluminium', number: 30 },
        { code: 'FBW', meaning: 'Wood, birch / hardwood', number: 32 },
        { code: 'HSI', meaning: 'Elastomer, silicone', number: 33 },
        { code: 'JPP', meaning: 'Laminate, paper / polymer', number: 34 },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: 'CP', meaning: 'CPET coated', number: 7 },
        { code: 'GR', meaning: 'Grease-resistant coating', number: 8 },
        { code: 'LM', meaning: 'Film laminated', number: 10 },
        { code: 'NC', meaning: 'No coating, as stated by the source', number: 1 },
        { code: 'PB', meaning: 'PE both sides', number: 4 },
        { code: 'PI', meaning: 'PE inside only', number: 2 },
        { code: 'PL', meaning: 'PLA lined', number: 6 },
        { code: 'PO', meaning: 'PE outside only', number: 3 },
        { code: 'PU', meaning: 'PE, side not stated', number: 5 },
        { code: 'SC', meaning: 'Silicone coated', number: 11 },
        { code: 'WC', meaning: 'Wax coated', number: 9 },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: 'BK', meaning: 'Black', number: 5 },
        { code: 'BR', meaning: 'Brown', number: 4 },
        { code: 'CL', meaning: 'Clear', number: 1 },
        { code: 'TL', meaning: 'Translucent', number: 2 },
        { code: 'WH', meaning: 'White', number: 3 },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'OV', meaning: 'Oval', number: 4 },
        { code: 'RC', meaning: 'Rectangular', number: 3 },
        { code: 'RD', meaning: 'Round', number: 1 },
        { code: 'SQ', meaning: 'Square', number: 2 },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: 'DM', meaning: 'Dome', number: 1 },
        { code: 'FL', meaning: 'Flat', number: 3 },
        { code: 'HD', meaning: 'Half dome', number: 2 },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'G', meaning: 'Grams', number: 5 },
        { code: 'M', meaning: 'Millilitres', number: 2 },
        { code: 'N', meaning: 'Count', number: 4 },
        { code: 'S', meaning: 'Servings', number: 3 },
        { code: 'Z', meaning: 'Ounces, nominal trade size', number: 1 },
      ],
    },
    {
      key: 'wall',
      name: 'Wall',
      values: [
        { code: 'DW', meaning: 'Double wall', number: 2 },
        { code: 'RW', meaning: 'Ripple wall', number: 3 },
        { code: 'SW', meaning: 'Single wall', number: 1 },
      ],
    },
    {
      key: 'print',
      name: 'Print',
      values: [
        { code: '01', meaning: '1 colour', number: 2 },
        { code: '02', meaning: '2 colours', number: 3 },
        { code: '03', meaning: '3 colours', number: 4 },
        { code: '04', meaning: '4 colours', number: 5 },
        { code: '05', meaning: '5 colours', number: 6 },
        { code: '06', meaning: '6 colours', number: 7 },
        { code: '07', meaning: '7 colours', number: 8 },
        { code: '08', meaning: '8 colours', number: 9 },
        { code: 'FC', meaning: 'Full colour', number: 10 },
        { code: 'NP', meaning: 'No print', number: 1 },
      ],
    },
    {
      key: 'lidOpening',
      name: 'Lid opening',
      values: [
        { code: 'CO', meaning: 'Closed', number: 1 },
        { code: 'SH', meaning: 'Straw hole or slit', number: 3 },
        { code: 'SP', meaning: 'Sip-through opening', number: 2 },
      ],
    },
    {
      key: 'handle',
      name: 'Handle',
      values: [
        { code: 'FT', meaning: 'Flat tape', number: 3 },
        { code: 'NH', meaning: 'No handle', number: 1 },
        { code: 'TS', meaning: 'T-shirt (vest)', number: 4 },
        { code: 'TW', meaning: 'Twisted paper', number: 2 },
      ],
    },
    {
      key: 'wrap',
      name: 'Individual wrap',
      values: [
        { code: 'FW', meaning: 'Film-wrapped', number: 3 },
        { code: 'NW', meaning: 'Not wrapped', number: 1 },
        { code: 'PW', meaning: 'Paper-wrapped', number: 2 },
      ],
    },
    {
      key: 'window',
      name: 'Window',
      values: [
        { code: 'NN', meaning: 'No window', number: 1 },
        { code: 'WN', meaning: 'With window', number: 2 },
      ],
    },
  ],
  rules: Object.entries(S2_RULES).flatMap(([productType, rules]) =>
    S2_RULED_ORDER.map((slot, index) => ({ productType, slot, rule: rules[index] ?? 'never' })),
  ),
};

export function savedFor(code: string, name: string, overrides: Partial<SavedSpecId> = {}): SavedSpecId {
  return {
    ...decodedFor(code),
    id: '00000000-0000-4000-8000-000000000001',
    name,
    savedBy: { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' },
    savedAt: new Date('2026-10-16T08:00:00.000Z'),
    version: 1,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

/** `savedFor`, found by the code it has now. */
export function lookupFor(code: string, name: string, overrides: Partial<SpecIdLookup> = {}): SpecIdLookup {
  return { ...savedFor(code, name), replacedCode: null, formerHolders: [], ...overrides };
}

/** A gateway whose every call waits forever, but for the ones given. */
export function gatewayWith(overrides: Partial<AtlasGateway>): AtlasGateway {
  const pending = () => new Promise<never>(() => undefined);
  return {
    dictionary: pending,
    decode: pending,
    encode: pending,
    save: pending,
    findByCode: pending,
    findSimilar: pending,
    readText: pending,
    getSaved: pending,
    update: pending,
    history: pending,
    manufacturers: pending,
    setManufacturerStage: pending,
    library: pending,
    ...overrides,
  };
}
