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

/** Test doubles for the Atlas feature. Never imported by production code. */

/** The specification's illustrative bowl lid. Every other value in the tests is invented. */
export const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', searchWords: [] },
        { code: 'BPA', meaning: 'Paper, plain', searchWords: [] },
      ],
    },
    { key: 'coating', name: 'Coating', values: [{ code: 'PE', meaning: 'Polyethylene', searchWords: [] }] },
    { key: 'colourClarity', name: 'Colour / clarity', values: [{ code: 'CL', meaning: 'Clear', searchWords: [] }] },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', searchWords: [] },
        { code: 'SQ', meaning: 'Square', searchWords: [] },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', searchWords: [] }] },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'Z', meaning: 'Ounces', searchWords: [] },
        { code: 'M', meaning: 'Millilitres', searchWords: [] },
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

/** The 25 slots of `code`, each meaning just the raw text, except the product type. */
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
        state: 'value' as const,
        meaning: slot.key === 'productType' ? 'Bowl lid' : raw,
      };
    }),
  };
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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', searchWords: [] },
        { code: 'CLD', meaning: 'Cup lid', searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', searchWords: [] },
        { code: 'SUP', meaning: 'Stand-up pouch', searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', searchWords: [] },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', searchWords: [] },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', searchWords: [] },
        { code: 'SQ', meaning: 'Square', searchWords: [] },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', searchWords: [] }] },
    { key: 'capacity', name: 'Nominal capacity', values: [{ code: 'Z', meaning: 'Ounces, nominal trade size', searchWords: [] }] },
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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BAG', meaning: 'Bag', searchWords: [] },
        { code: 'BLD', meaning: 'Bowl lid', searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', searchWords: [] },
        { code: 'CCR', meaning: 'Cup carrier', searchWords: [] },
        { code: 'CKT', meaning: 'Cutlery kit', searchWords: [] },
        { code: 'CLD', meaning: 'Cup lid', searchWords: [] },
        { code: 'CTL', meaning: 'Container lid', searchWords: [] },
        { code: 'CTN', meaning: 'Container', searchWords: [] },
        { code: 'CUP', meaning: 'Cup', searchWords: [] },
        { code: 'CWL', meaning: 'Container with lid', searchWords: [] },
        { code: 'FCB', meaning: 'Folding carton', searchWords: [] },
        { code: 'FLM', meaning: 'Film or roll', searchWords: [] },
        { code: 'FRC', meaning: 'Fry carton', searchWords: [] },
        { code: 'FRK', meaning: 'Fork', searchWords: [] },
        { code: 'HCT', meaning: 'Hinged container (clamshell)', searchWords: [] },
        { code: 'KNF', meaning: 'Knife', searchWords: [] },
        { code: 'LBL', meaning: 'Label', searchWords: [] },
        { code: 'NPK', meaning: 'Napkin', searchWords: [] },
        { code: 'PAN', meaning: 'Pan', searchWords: [] },
        { code: 'PCL', meaning: 'Portion cup lid', searchWords: [] },
        { code: 'PCP', meaning: 'Portion cup', searchWords: [] },
        { code: 'PLT', meaning: 'Plate', searchWords: [] },
        { code: 'RSC', meaning: 'Shipping box (RSC)', searchWords: [] },
        { code: 'SCH', meaning: 'Sachet', searchWords: [] },
        { code: 'SPN', meaning: 'Spoon', searchWords: [] },
        { code: 'STR', meaning: 'Stirrer', searchWords: [] },
        { code: 'STW', meaning: 'Straw', searchWords: [] },
        { code: 'SUP', meaning: 'Stand-up pouch', searchWords: [] },
        { code: 'TKB', meaning: 'Takeout box', searchWords: [] },
        { code: 'TRY', meaning: 'Tray', searchWords: [] },
        { code: 'WRP', meaning: 'Wrap or sheet', searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'A00', meaning: 'Polymer, grade not known', searchWords: [] },
        { code: 'AEP', meaning: 'Polymer, EPS foam', searchWords: [] },
        { code: 'AHD', meaning: 'Polymer, HDPE', searchWords: [] },
        { code: 'ALD', meaning: 'Polymer, LDPE', searchWords: [] },
        { code: 'ALL', meaning: 'Polymer, LLDPE', searchWords: [] },
        { code: 'APL', meaning: 'Polymer, PLA', searchWords: [] },
        { code: 'APM', meaning: 'Polymer, PSM (starch blend)', searchWords: [] },
        { code: 'APP', meaning: 'Polymer, PP', searchWords: [] },
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', searchWords: [] },
        { code: 'APT', meaning: 'Polymer, PET', searchWords: [] },
        { code: 'ARP', meaning: 'Polymer, rPET', searchWords: [] },
        { code: 'B00', meaning: 'Paper and paperboard, grade not known', searchWords: [] },
        { code: 'BCB', meaning: 'Paper and paperboard, corrugated', searchWords: [] },
        { code: 'BCS', meaning: 'Paper and paperboard, cup stock', searchWords: [] },
        { code: 'BGP', meaning: 'Paper and paperboard, greaseproof', searchWords: [] },
        { code: 'BKB', meaning: 'Paper and paperboard, brown kraft', searchWords: [] },
        { code: 'BKC', meaning: 'Paper and paperboard, recycled kraft', searchWords: [] },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', searchWords: [] },
        { code: 'BKV', meaning: 'Paper and paperboard, virgin kraft', searchWords: [] },
        { code: 'BKW', meaning: 'Paper and paperboard, white kraft', searchWords: [] },
        { code: 'BSB', meaning: 'Paper and paperboard, SBS', searchWords: [] },
        { code: 'BSG', meaning: 'Paper and paperboard, semi-gloss', searchWords: [] },
        { code: 'BTS', meaning: 'Paper and paperboard, tissue', searchWords: [] },
        { code: 'BWP', meaning: 'Paper and paperboard, wax paper', searchWords: [] },
        { code: 'C00', meaning: 'Molded fibre, grade not known', searchWords: [] },
        { code: 'CBG', meaning: 'Molded fibre, bagasse', searchWords: [] },
        { code: 'CBM', meaning: 'Molded fibre, bamboo', searchWords: [] },
        { code: 'CGR', meaning: 'Molded fibre, grass', searchWords: [] },
        { code: 'CSW', meaning: 'Molded fibre, seaweed', searchWords: [] },
        { code: 'D00', meaning: 'Metal, grade not known', searchWords: [] },
        { code: 'DAL', meaning: 'Metal, aluminium', searchWords: [] },
        { code: 'FBW', meaning: 'Wood, birch / hardwood', searchWords: [] },
        { code: 'HSI', meaning: 'Elastomer, silicone', searchWords: [] },
        { code: 'JPP', meaning: 'Laminate, paper / polymer', searchWords: [] },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: 'CP', meaning: 'CPET coated', searchWords: [] },
        { code: 'GR', meaning: 'Grease-resistant coating', searchWords: [] },
        { code: 'LM', meaning: 'Film laminated', searchWords: [] },
        { code: 'NC', meaning: 'No coating, as stated by the source', searchWords: [] },
        { code: 'PB', meaning: 'PE both sides', searchWords: [] },
        { code: 'PI', meaning: 'PE inside only', searchWords: [] },
        { code: 'PL', meaning: 'PLA lined', searchWords: [] },
        { code: 'PO', meaning: 'PE outside only', searchWords: [] },
        { code: 'PU', meaning: 'PE, side not stated', searchWords: [] },
        { code: 'SC', meaning: 'Silicone coated', searchWords: [] },
        { code: 'WC', meaning: 'Wax coated', searchWords: [] },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: 'BK', meaning: 'Black', searchWords: [] },
        { code: 'BR', meaning: 'Brown', searchWords: [] },
        { code: 'CL', meaning: 'Clear', searchWords: [] },
        { code: 'TL', meaning: 'Translucent', searchWords: [] },
        { code: 'WH', meaning: 'White', searchWords: [] },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'OV', meaning: 'Oval', searchWords: [] },
        { code: 'RC', meaning: 'Rectangular', searchWords: [] },
        { code: 'RD', meaning: 'Round', searchWords: [] },
        { code: 'SQ', meaning: 'Square', searchWords: [] },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: 'DM', meaning: 'Dome', searchWords: [] },
        { code: 'FL', meaning: 'Flat', searchWords: [] },
        { code: 'HD', meaning: 'Half dome', searchWords: [] },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'G', meaning: 'Grams', searchWords: [] },
        { code: 'M', meaning: 'Millilitres', searchWords: [] },
        { code: 'N', meaning: 'Count', searchWords: [] },
        { code: 'S', meaning: 'Servings', searchWords: [] },
        { code: 'Z', meaning: 'Ounces, nominal trade size', searchWords: [] },
      ],
    },
    {
      key: 'wall',
      name: 'Wall',
      values: [
        { code: 'DW', meaning: 'Double wall', searchWords: [] },
        { code: 'RW', meaning: 'Ripple wall', searchWords: [] },
        { code: 'SW', meaning: 'Single wall', searchWords: [] },
      ],
    },
    {
      key: 'print',
      name: 'Print',
      values: [
        { code: '01', meaning: '1 colour', searchWords: [] },
        { code: '02', meaning: '2 colours', searchWords: [] },
        { code: '03', meaning: '3 colours', searchWords: [] },
        { code: '04', meaning: '4 colours', searchWords: [] },
        { code: '05', meaning: '5 colours', searchWords: [] },
        { code: '06', meaning: '6 colours', searchWords: [] },
        { code: '07', meaning: '7 colours', searchWords: [] },
        { code: '08', meaning: '8 colours', searchWords: [] },
        { code: 'FC', meaning: 'Full colour', searchWords: [] },
        { code: 'NP', meaning: 'No print', searchWords: [] },
      ],
    },
    {
      key: 'lidOpening',
      name: 'Lid opening',
      values: [
        { code: 'CO', meaning: 'Closed', searchWords: [] },
        { code: 'SH', meaning: 'Straw hole or slit', searchWords: [] },
        { code: 'SP', meaning: 'Sip-through opening', searchWords: [] },
      ],
    },
    {
      key: 'handle',
      name: 'Handle',
      values: [
        { code: 'FT', meaning: 'Flat tape', searchWords: [] },
        { code: 'NH', meaning: 'No handle', searchWords: [] },
        { code: 'TS', meaning: 'T-shirt (vest)', searchWords: [] },
        { code: 'TW', meaning: 'Twisted paper', searchWords: [] },
      ],
    },
    {
      key: 'wrap',
      name: 'Individual wrap',
      values: [
        { code: 'FW', meaning: 'Film-wrapped', searchWords: [] },
        { code: 'NW', meaning: 'Not wrapped', searchWords: [] },
        { code: 'PW', meaning: 'Paper-wrapped', searchWords: [] },
      ],
    },
    {
      key: 'window',
      name: 'Window',
      values: [
        { code: 'NN', meaning: 'No window', searchWords: [] },
        { code: 'WN', meaning: 'With window', searchWords: [] },
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
