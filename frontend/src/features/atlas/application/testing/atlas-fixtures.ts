import type { AtlasGateway } from '../atlas-gateway';
import {
  SLOT_NAMES,
  type AtlasDictionary,
  type DecodedSpecId,
  type SavedSpecId,
  type SlotKey,
  type SlotRule,
  type SlotRuleEntry,
} from '../../domain/atlas';

/** Test doubles for the Atlas feature. Never imported by production code. */

/** The specification's illustrative bowl lid. Every other value in the tests is invented. */
export const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

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
  release: 'S1 0.1.0',
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

/** The 18 slots of `code`, each meaning just the raw text, except the product type. */
export function decodedFor(code: string): DecodedSpecId {
  const parts = code.split('.');
  return {
    code,
    dictionaryRelease: 'S1 0.1.0',
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

export function savedFor(code: string, name: string, overrides: Partial<SavedSpecId> = {}): SavedSpecId {
  return {
    ...decodedFor(code),
    name,
    savedBy: { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' },
    savedAt: new Date('2026-10-16T08:00:00.000Z'),
    ...overrides,
  };
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
    ...overrides,
  };
}
