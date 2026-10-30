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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', number: 3, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', number: 4, broader: null, searchWords: [] },
        { code: 'BPA', meaning: 'Paper, plain', number: 35, broader: null, searchWords: [] },
      ],
    },
    { key: 'coating', name: 'Coating', values: [{ code: 'PE', meaning: 'Polyethylene', number: 12, broader: null, searchWords: [] }] },
    { key: 'colourClarity', name: 'Colour / clarity', values: [{ code: 'CL', meaning: 'Clear', number: 1, broader: null, searchWords: [] }] },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', number: 1, broader: null, searchWords: [] },
        { code: 'SQ', meaning: 'Square', number: 2, broader: null, searchWords: [] },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', number: 1, broader: null, searchWords: [] }] },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: 'Z', meaning: 'Ounces', number: 1, broader: null, searchWords: [] },
        { code: 'M', meaning: 'Millilitres', number: 2, broader: null, searchWords: [] },
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

/**
 * Each S2 0.1.0 option's number by the letters a dotted code wrote it with,
 * as migration 0021 keeps them in `legacy_code` (ADR 0033).
 */
const S2_LETTERS: Readonly<Record<string, number>> = {
  'productType:BLD': 1,
  'productType:CLD': 2,
  'productType:BWL': 3,
  'productType:SUP': 4,
  'productType:CUP': 5,
  'productType:PCP': 6,
  'productType:PCL': 7,
  'productType:CTN': 8,
  'productType:CTL': 9,
  'productType:CWL': 10,
  'productType:HCT': 11,
  'productType:TKB': 12,
  'productType:FRC': 13,
  'productType:FCB': 14,
  'productType:RSC': 15,
  'productType:BAG': 16,
  'productType:NPK': 17,
  'productType:WRP': 18,
  'productType:FLM': 19,
  'productType:PLT': 20,
  'productType:TRY': 21,
  'productType:PAN': 22,
  'productType:CCR': 23,
  'productType:STW': 24,
  'productType:STR': 25,
  'productType:FRK': 26,
  'productType:KNF': 27,
  'productType:SPN': 28,
  'productType:CKT': 29,
  'productType:SCH': 30,
  'productType:LBL': 31,
  'productType:BWB': 32,
  'productType:CWC': 33,
  'productType:PWC': 34,
  'material:APT': 1,
  'material:ARP': 2,
  'material:APP': 3,
  'material:APS': 4,
  'material:AEP': 5,
  'material:AHD': 6,
  'material:ALD': 7,
  'material:ALL': 8,
  'material:APL': 9,
  'material:APM': 10,
  'material:A00': 11,
  'material:BKR': 12,
  'material:BKB': 13,
  'material:BKW': 14,
  'material:BKV': 15,
  'material:BKC': 16,
  'material:BCS': 17,
  'material:BSB': 18,
  'material:BCB': 19,
  'material:BGP': 20,
  'material:BTS': 21,
  'material:BWP': 22,
  'material:BSG': 23,
  'material:B00': 24,
  'material:CBG': 25,
  'material:CBM': 26,
  'material:CGR': 27,
  'material:CSW': 28,
  'material:C00': 29,
  'material:DAL': 30,
  'material:D00': 31,
  'material:FBW': 32,
  'material:HSI': 33,
  'material:JPP': 34,
  'coating:NC': 1,
  'coating:PI': 2,
  'coating:PO': 3,
  'coating:PB': 4,
  'coating:PU': 5,
  'coating:PL': 6,
  'coating:CP': 7,
  'coating:GR': 8,
  'coating:WC': 9,
  'coating:LM': 10,
  'coating:SC': 11,
  'colourClarity:CL': 1,
  'colourClarity:TL': 2,
  'colourClarity:WH': 3,
  'colourClarity:BR': 4,
  'colourClarity:BK': 5,
  'shape:RD': 1,
  'shape:SQ': 2,
  'shape:RC': 3,
  'shape:OV': 4,
  'profile:DM': 1,
  'profile:HD': 2,
  'profile:FL': 3,
  'capacity:Z': 1,
  'capacity:M': 2,
  'capacity:S': 3,
  'capacity:N': 4,
  'capacity:G': 5,
  'wall:SW': 1,
  'wall:DW': 2,
  'wall:RW': 3,
  'print:NP': 1,
  'print:01': 2,
  'print:02': 3,
  'print:03': 4,
  'print:04': 5,
  'print:05': 6,
  'print:06': 7,
  'print:07': 8,
  'print:08': 9,
  'print:FC': 10,
  'lidOpening:CO': 1,
  'lidOpening:SP': 2,
  'lidOpening:SH': 3,
  'handle:NH': 1,
  'handle:TW': 2,
  'handle:FT': 3,
  'handle:TS': 4,
  'wrap:NW': 1,
  'wrap:PW': 2,
  'wrap:FW': 3,
  'window:NN': 1,
  'window:WN': 2,
};

/** How a code written today writes a dotted code's slot text, numbered as in `s2Dictionary`; empty when left out. */
function partOf(key: SlotKey, raw: string): string {
  const letter = codeLetter(key);
  if (letter === undefined || raw === '' || raw === 'Y' || raw === 'X') return '';
  const numberOf = (slotKey: SlotKey, letters: string) => S2_LETTERS[`${slotKey}:${letters}`];
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
  change: null,
  slots: [
    {
      key: 'productType',
      name: 'Product type',
      values: [
        { code: 'BLD', meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] },
        { code: 'CLD', meaning: 'Cup lid', number: 2, broader: null, searchWords: [] },
        { code: 'BWL', meaning: 'Bowl', number: 3, broader: null, searchWords: [] },
        { code: 'SUP', meaning: 'Stand-up pouch', number: 4, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)', number: 4, broader: null, searchWords: [] },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft', number: 12, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: 'RD', meaning: 'Round', number: 1, broader: null, searchWords: [] },
        { code: 'SQ', meaning: 'Square', number: 2, broader: null, searchWords: [] },
      ],
    },
    { key: 'profile', name: 'Profile', values: [{ code: 'DM', meaning: 'Dome', number: 1, broader: null, searchWords: [] }] },
    { key: 'capacity', name: 'Nominal capacity', values: [{ code: 'Z', meaning: 'Ounces, nominal trade size', number: 1, broader: null, searchWords: [] }] },
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

/** Each product type's rules, in `S2_RULED_ORDER`, by its key: its number (ADR 0033). */
const S2_RULES: Record<string, readonly SlotRule[]> = {
  '1': ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '2': ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  '3': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '4': ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'applies', 'applies', 'applies', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies'],
  '5': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '6': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '7': ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  '8': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '9': ['applies', 'applies', 'applies', 'applies', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '10': ['applies', 'applies', 'applies', 'applies', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '11': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '12': ['applies', 'applies', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'applies'],
  '13': ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '14': ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies'],
  '15': ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '16': ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'applies', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'applies'],
  '17': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never'],
  '18': ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '19': ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '20': ['applies', 'applies', 'applies', 'never', 'never', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '21': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'never', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '22': ['applies', 'applies', 'applies', 'never', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '23': ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '24': ['never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '25': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'never', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '26': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '27': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '28': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '29': ['never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'applies', 'never'],
  '30': ['applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'applies', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '31': ['applies', 'applies', 'applies', 'never', 'never', 'round_only', 'never', 'never', 'non_round_only', 'non_round_only', 'never', 'never', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
  '32': ['applies', 'applies', 'applies', 'applies', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'applies', 'never', 'never', 'never', 'never', 'never'],
  '33': ['applies', 'applies', 'applies', 'applies', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'applies', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  '34': ['applies', 'applies', 'applies', 'applies', 'applies', 'round_only', 'round_only', 'applies', 'non_round_only', 'non_round_only', 'never', 'applies', 'paper_only', 'applies', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never'],
  '35': ['applies', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never', 'never', 'never'],
  '36': ['never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'applies', 'never', 'never', 'never', 'applies', 'paper_only', 'never', 'never', 'applies', 'never', 'never', 'never', 'never', 'never', 'never'],
};

/**
 * Release S2 0.1.0 as the API sends it, as the migrations leave it: each
 * slot's values by number, each one's key its number (ADR 0033), a
 * material's broader material, and every rule, by product type key.
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
        { code: '1', meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Cup lid', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Bowl', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'Stand-up pouch', number: 4, broader: null, searchWords: [] },
        { code: '5', meaning: 'Cup', number: 5, broader: null, searchWords: [] },
        { code: '6', meaning: 'Portion cup', number: 6, broader: null, searchWords: [] },
        { code: '7', meaning: 'Portion cup lid', number: 7, broader: null, searchWords: [] },
        { code: '8', meaning: 'Container', number: 8, broader: null, searchWords: [] },
        { code: '9', meaning: 'Container lid', number: 9, broader: null, searchWords: [] },
        { code: '10', meaning: 'Container with lid', number: 10, broader: null, searchWords: [] },
        { code: '11', meaning: 'Hinged container (clamshell)', number: 11, broader: null, searchWords: [] },
        { code: '12', meaning: 'Takeout box', number: 12, broader: null, searchWords: [] },
        { code: '13', meaning: 'Fry carton', number: 13, broader: null, searchWords: [] },
        { code: '14', meaning: 'Folding carton', number: 14, broader: null, searchWords: [] },
        { code: '15', meaning: 'Shipping box (RSC)', number: 15, broader: null, searchWords: [] },
        { code: '16', meaning: 'Bag', number: 16, broader: null, searchWords: [] },
        { code: '17', meaning: 'Napkin', number: 17, broader: null, searchWords: [] },
        { code: '18', meaning: 'Wrap or sheet', number: 18, broader: null, searchWords: [] },
        { code: '19', meaning: 'Film or roll', number: 19, broader: null, searchWords: [] },
        { code: '20', meaning: 'Plate', number: 20, broader: null, searchWords: [] },
        { code: '21', meaning: 'Tray', number: 21, broader: null, searchWords: [] },
        { code: '22', meaning: 'Pan', number: 22, broader: null, searchWords: [] },
        { code: '23', meaning: 'Cup carrier', number: 23, broader: null, searchWords: [] },
        { code: '24', meaning: 'Straw', number: 24, broader: null, searchWords: [] },
        { code: '25', meaning: 'Stirrer', number: 25, broader: null, searchWords: [] },
        { code: '26', meaning: 'Fork', number: 26, broader: null, searchWords: [] },
        { code: '27', meaning: 'Knife', number: 27, broader: null, searchWords: [] },
        { code: '28', meaning: 'Spoon', number: 28, broader: null, searchWords: [] },
        { code: '29', meaning: 'Cutlery kit', number: 29, broader: null, searchWords: [] },
        { code: '30', meaning: 'Sachet', number: 30, broader: null, searchWords: [] },
        { code: '31', meaning: 'Label', number: 31, broader: null, searchWords: [] },
        { code: '32', meaning: 'Bowl with Bowl Lid', number: 32, broader: null, searchWords: [] },
        { code: '33', meaning: 'Cup with Cup Lid', number: 33, broader: null, searchWords: [] },
        { code: '34', meaning: 'Portion cup with Portion cup lid', number: 34, broader: null, searchWords: [] },
        { code: '35', meaning: 'Glove', number: 35, broader: null, searchWords: [] },
        { code: '36', meaning: 'Cup sleeve', number: 36, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: '1', meaning: 'Polymer, PET', number: 1, broader: '11', searchWords: [] },
        { code: '2', meaning: 'Polymer, rPET', number: 2, broader: '11', searchWords: [] },
        { code: '3', meaning: 'Polymer, PP', number: 3, broader: '11', searchWords: [] },
        { code: '4', meaning: 'Polymer, PS (polystyrene)', number: 4, broader: '11', searchWords: [] },
        { code: '5', meaning: 'Polymer, EPS foam', number: 5, broader: '11', searchWords: [] },
        { code: '6', meaning: 'Polymer, HDPE', number: 6, broader: '11', searchWords: [] },
        { code: '7', meaning: 'Polymer, LDPE', number: 7, broader: '11', searchWords: [] },
        { code: '8', meaning: 'Polymer, LLDPE', number: 8, broader: '11', searchWords: [] },
        { code: '9', meaning: 'Polymer, PLA', number: 9, broader: '11', searchWords: [] },
        { code: '10', meaning: 'Polymer, PSM (starch blend)', number: 10, broader: '11', searchWords: [] },
        { code: '11', meaning: 'Polymer, grade not known', number: 11, broader: null, searchWords: [] },
        { code: '12', meaning: 'Paper and paperboard, kraft', number: 12, broader: '24', searchWords: [] },
        { code: '13', meaning: 'Paper and paperboard, brown kraft', number: 13, broader: '12', searchWords: [] },
        { code: '14', meaning: 'Paper and paperboard, white kraft', number: 14, broader: '12', searchWords: [] },
        { code: '15', meaning: 'Paper and paperboard, virgin kraft', number: 15, broader: '12', searchWords: [] },
        { code: '16', meaning: 'Paper and paperboard, recycled kraft', number: 16, broader: '12', searchWords: [] },
        { code: '17', meaning: 'Paper and paperboard, cup stock', number: 17, broader: '24', searchWords: [] },
        { code: '18', meaning: 'Paper and paperboard, SBS', number: 18, broader: '24', searchWords: [] },
        { code: '19', meaning: 'Paper and paperboard, corrugated', number: 19, broader: '24', searchWords: [] },
        { code: '20', meaning: 'Paper and paperboard, greaseproof', number: 20, broader: '24', searchWords: [] },
        { code: '21', meaning: 'Paper and paperboard, tissue', number: 21, broader: '24', searchWords: [] },
        { code: '22', meaning: 'Paper and paperboard, wax paper', number: 22, broader: '24', searchWords: [] },
        { code: '23', meaning: 'Paper and paperboard, semi-gloss', number: 23, broader: '24', searchWords: [] },
        { code: '24', meaning: 'Paper and paperboard, grade not known', number: 24, broader: null, searchWords: [] },
        { code: '25', meaning: 'Molded fibre, bagasse', number: 25, broader: '29', searchWords: [] },
        { code: '26', meaning: 'Molded fibre, bamboo', number: 26, broader: '29', searchWords: [] },
        { code: '27', meaning: 'Molded fibre, grass', number: 27, broader: '29', searchWords: [] },
        { code: '28', meaning: 'Molded fibre, seaweed', number: 28, broader: '29', searchWords: [] },
        { code: '29', meaning: 'Molded fibre, grade not known', number: 29, broader: null, searchWords: [] },
        { code: '30', meaning: 'Metal, aluminium', number: 30, broader: '31', searchWords: [] },
        { code: '31', meaning: 'Metal, grade not known', number: 31, broader: null, searchWords: [] },
        { code: '32', meaning: 'Wood, birch / hardwood', number: 32, broader: null, searchWords: [] },
        { code: '33', meaning: 'Elastomer, silicone', number: 33, broader: null, searchWords: [] },
        { code: '34', meaning: 'Laminate, paper / polymer', number: 34, broader: null, searchWords: [] },
        { code: '35', meaning: 'Elastomer, nitrile', number: 35, broader: null, searchWords: [] },
        { code: '36', meaning: 'Elastomer, latex', number: 36, broader: null, searchWords: [] },
        { code: '37', meaning: 'Polymer, vinyl (PVC)', number: 37, broader: '11', searchWords: [] },
        { code: '38', meaning: 'Polymer, CPE', number: 38, broader: '11', searchWords: [] },
      ],
    },
    {
      key: 'coating',
      name: 'Coating',
      values: [
        { code: '1', meaning: 'No coating, as stated by the source', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'PE inside only', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'PE outside only', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'PE both sides', number: 4, broader: null, searchWords: [] },
        { code: '5', meaning: 'PE, side not stated', number: 5, broader: null, searchWords: [] },
        { code: '6', meaning: 'PLA lined', number: 6, broader: null, searchWords: [] },
        { code: '7', meaning: 'CPET coated', number: 7, broader: null, searchWords: [] },
        { code: '8', meaning: 'Grease-resistant coating', number: 8, broader: null, searchWords: [] },
        { code: '9', meaning: 'Wax coated', number: 9, broader: null, searchWords: [] },
        { code: '10', meaning: 'Film laminated', number: 10, broader: null, searchWords: [] },
        { code: '11', meaning: 'Silicone coated', number: 11, broader: null, searchWords: [] },
        { code: '12', meaning: 'Powder-free', number: 12, broader: null, searchWords: [] },
        { code: '13', meaning: 'Powdered', number: 13, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'colourClarity',
      name: 'Colour / clarity',
      values: [
        { code: '1', meaning: 'Clear', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Translucent', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'White', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'Brown', number: 4, broader: null, searchWords: [] },
        { code: '5', meaning: 'Black', number: 5, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'shape',
      name: 'Shape',
      values: [
        { code: '1', meaning: 'Round', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Square', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Rectangular', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'Oval', number: 4, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'profile',
      name: 'Profile',
      values: [
        { code: '1', meaning: 'Dome', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Half dome', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Flat', number: 3, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'capacity',
      name: 'Nominal capacity',
      values: [
        { code: '1', meaning: 'Ounces, nominal trade size', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Millilitres', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Servings', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'Count', number: 4, broader: null, searchWords: [] },
        { code: '5', meaning: 'Grams', number: 5, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'wall',
      name: 'Wall',
      values: [
        { code: '1', meaning: 'Single wall', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Double wall', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Ripple wall', number: 3, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'print',
      name: 'Print',
      values: [
        { code: '1', meaning: 'No print', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: '1 colour', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: '2 colours', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: '3 colours', number: 4, broader: null, searchWords: [] },
        { code: '5', meaning: '4 colours', number: 5, broader: null, searchWords: [] },
        { code: '6', meaning: '5 colours', number: 6, broader: null, searchWords: [] },
        { code: '7', meaning: '6 colours', number: 7, broader: null, searchWords: [] },
        { code: '8', meaning: '7 colours', number: 8, broader: null, searchWords: [] },
        { code: '9', meaning: '8 colours', number: 9, broader: null, searchWords: [] },
        { code: '10', meaning: 'Full colour', number: 10, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'lidOpening',
      name: 'Lid opening',
      values: [
        { code: '1', meaning: 'Closed', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Sip-through opening', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Straw hole or slit', number: 3, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'handle',
      name: 'Handle',
      values: [
        { code: '1', meaning: 'No handle', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Twisted paper', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Flat tape', number: 3, broader: null, searchWords: [] },
        { code: '4', meaning: 'T-shirt (vest)', number: 4, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'wrap',
      name: 'Individual wrap',
      values: [
        { code: '1', meaning: 'Not wrapped', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'Paper-wrapped', number: 2, broader: null, searchWords: [] },
        { code: '3', meaning: 'Film-wrapped', number: 3, broader: null, searchWords: [] },
      ],
    },
    {
      key: 'window',
      name: 'Window',
      values: [
        { code: '1', meaning: 'No window', number: 1, broader: null, searchWords: [] },
        { code: '2', meaning: 'With window', number: 2, broader: null, searchWords: [] },
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
