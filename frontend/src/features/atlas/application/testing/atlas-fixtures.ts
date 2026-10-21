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
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid' },
        { code: 'BWL', meaning: 'Bowl' },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
        { code: 'BPA', meaning: 'Paper, plain' },
      ],
    },
    { key: 'coating', name: 'Coating', values: [{ code: 'PE', meaning: 'Polyethylene' }] },
    { key: 'colourClarity', name: 'Colour / clarity', values: [{ code: 'CL', meaning: 'Clear' }] },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round' },
        { code: 'SQ', meaning: 'Square' },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome' }] },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'Z', meaning: 'Ounces' },
        { code: 'M', meaning: 'Millilitres' },
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
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid' },
        { code: 'CLD', meaning: 'Cup lid' },
        { code: 'BWL', meaning: 'Bowl' },
        { code: 'SUP', meaning: 'Stand-up pouch' },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft' },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round' },
        { code: 'SQ', meaning: 'Square' },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome' }] },
    { key: 'capacity', name: 'Nominal capacity', values: [{ code: 'Z', meaning: 'Ounces, nominal trade size' }] },
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
        { code: 'BAG', meaning: 'Bag' },
        { code: 'BLD', meaning: 'Bowl lid' },
        { code: 'BWL', meaning: 'Bowl' },
        { code: 'CCR', meaning: 'Cup carrier' },
        { code: 'CKT', meaning: 'Cutlery kit' },
        { code: 'CLD', meaning: 'Cup lid' },
        { code: 'CTL', meaning: 'Container lid' },
        { code: 'CTN', meaning: 'Container' },
        { code: 'CUP', meaning: 'Cup' },
        { code: 'CWL', meaning: 'Container with lid' },
        { code: 'FCB', meaning: 'Folding carton' },
        { code: 'FLM', meaning: 'Film or roll' },
        { code: 'FRC', meaning: 'Fry carton' },
        { code: 'FRK', meaning: 'Fork' },
        { code: 'HCT', meaning: 'Hinged container (clamshell)' },
        { code: 'KNF', meaning: 'Knife' },
        { code: 'LBL', meaning: 'Label' },
        { code: 'NPK', meaning: 'Napkin' },
        { code: 'PAN', meaning: 'Pan' },
        { code: 'PCL', meaning: 'Portion cup lid' },
        { code: 'PCP', meaning: 'Portion cup' },
        { code: 'PLT', meaning: 'Plate' },
        { code: 'RSC', meaning: 'Shipping box (RSC)' },
        { code: 'SCH', meaning: 'Sachet' },
        { code: 'SPN', meaning: 'Spoon' },
        { code: 'STR', meaning: 'Stirrer' },
        { code: 'STW', meaning: 'Straw' },
        { code: 'SUP', meaning: 'Stand-up pouch' },
        { code: 'TKB', meaning: 'Takeout box' },
        { code: 'TRY', meaning: 'Tray' },
        { code: 'WRP', meaning: 'Wrap or sheet' },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'A00', meaning: 'Polymer, grade not known' },
        { code: 'AEP', meaning: 'Polymer, EPS foam' },
        { code: 'AHD', meaning: 'Polymer, HDPE' },
        { code: 'ALD', meaning: 'Polymer, LDPE' },
        { code: 'ALL', meaning: 'Polymer, LLDPE' },
        { code: 'APL', meaning: 'Polymer, PLA' },
        { code: 'APM', meaning: 'Polymer, PSM (starch blend)' },
        { code: 'APP', meaning: 'Polymer, PP' },
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
        { code: 'APT', meaning: 'Polymer, PET' },
        { code: 'ARP', meaning: 'Polymer, rPET' },
        { code: 'B00', meaning: 'Paper and paperboard, grade not known' },
        { code: 'BCB', meaning: 'Paper and paperboard, corrugated' },
        { code: 'BCS', meaning: 'Paper and paperboard, cup stock' },
        { code: 'BGP', meaning: 'Paper and paperboard, greaseproof' },
        { code: 'BKB', meaning: 'Paper and paperboard, brown kraft' },
        { code: 'BKC', meaning: 'Paper and paperboard, recycled kraft' },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft' },
        { code: 'BKV', meaning: 'Paper and paperboard, virgin kraft' },
        { code: 'BKW', meaning: 'Paper and paperboard, white kraft' },
        { code: 'BSB', meaning: 'Paper and paperboard, SBS' },
        { code: 'BSG', meaning: 'Paper and paperboard, semi-gloss' },
        { code: 'BTS', meaning: 'Paper and paperboard, tissue' },
        { code: 'BWP', meaning: 'Paper and paperboard, wax paper' },
        { code: 'C00', meaning: 'Molded fibre, grade not known' },
        { code: 'CBG', meaning: 'Molded fibre, bagasse' },
        { code: 'CBM', meaning: 'Molded fibre, bamboo' },
        { code: 'CGR', meaning: 'Molded fibre, grass' },
        { code: 'CSW', meaning: 'Molded fibre, seaweed' },
        { code: 'D00', meaning: 'Metal, grade not known' },
        { code: 'DAL', meaning: 'Metal, aluminium' },
        { code: 'FBW', meaning: 'Wood, birch / hardwood' },
        { code: 'HSI', meaning: 'Elastomer, silicone' },
        { code: 'JPP', meaning: 'Laminate, paper / polymer' },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: 'CP', meaning: 'CPET coated' },
        { code: 'GR', meaning: 'Grease-resistant coating' },
        { code: 'LM', meaning: 'Film laminated' },
        { code: 'NC', meaning: 'No coating, as stated by the source' },
        { code: 'PB', meaning: 'PE both sides' },
        { code: 'PI', meaning: 'PE inside only' },
        { code: 'PL', meaning: 'PLA lined' },
        { code: 'PO', meaning: 'PE outside only' },
        { code: 'PU', meaning: 'PE, side not stated' },
        { code: 'SC', meaning: 'Silicone coated' },
        { code: 'WC', meaning: 'Wax coated' },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: 'BK', meaning: 'Black' },
        { code: 'BR', meaning: 'Brown' },
        { code: 'CL', meaning: 'Clear' },
        { code: 'TL', meaning: 'Translucent' },
        { code: 'WH', meaning: 'White' },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'OV', meaning: 'Oval' },
        { code: 'RC', meaning: 'Rectangular' },
        { code: 'RD', meaning: 'Round' },
        { code: 'SQ', meaning: 'Square' },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: 'DM', meaning: 'Dome' },
        { code: 'FL', meaning: 'Flat' },
        { code: 'HD', meaning: 'Half dome' },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'G', meaning: 'Grams' },
        { code: 'M', meaning: 'Millilitres' },
        { code: 'N', meaning: 'Count' },
        { code: 'S', meaning: 'Servings' },
        { code: 'Z', meaning: 'Ounces, nominal trade size' },
      ],
    },
    {
      key: 'wall',
      name: 'Wall',
      values: [
        { code: 'DW', meaning: 'Double wall' },
        { code: 'RW', meaning: 'Ripple wall' },
        { code: 'SW', meaning: 'Single wall' },
      ],
    },
    {
      key: 'print',
      name: 'Print',
      values: [
        { code: '01', meaning: '1 colour' },
        { code: '02', meaning: '2 colours' },
        { code: '03', meaning: '3 colours' },
        { code: '04', meaning: '4 colours' },
        { code: '05', meaning: '5 colours' },
        { code: '06', meaning: '6 colours' },
        { code: '07', meaning: '7 colours' },
        { code: '08', meaning: '8 colours' },
        { code: 'FC', meaning: 'Full colour' },
        { code: 'NP', meaning: 'No print' },
      ],
    },
    {
      key: 'lidOpening',
      name: 'Lid opening',
      values: [
        { code: 'CO', meaning: 'Closed' },
        { code: 'SH', meaning: 'Straw hole or slit' },
        { code: 'SP', meaning: 'Sip-through opening' },
      ],
    },
    {
      key: 'handle',
      name: 'Handle',
      values: [
        { code: 'FT', meaning: 'Flat tape' },
        { code: 'NH', meaning: 'No handle' },
        { code: 'TS', meaning: 'T-shirt (vest)' },
        { code: 'TW', meaning: 'Twisted paper' },
      ],
    },
    {
      key: 'wrap',
      name: 'Individual wrap',
      values: [
        { code: 'FW', meaning: 'Film-wrapped' },
        { code: 'NW', meaning: 'Not wrapped' },
        { code: 'PW', meaning: 'Paper-wrapped' },
      ],
    },
    {
      key: 'window',
      name: 'Window',
      values: [
        { code: 'NN', meaning: 'No window' },
        { code: 'WN', meaning: 'With window' },
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
    library: pending,
    ...overrides,
  };
}
