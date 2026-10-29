import type { SlotKey } from '../slots.js';

/** Edges of a whole word: no letter or digit just before or after (ADR 0026). */
const BEFORE = '(?<![a-z0-9])';
const AFTER = '(?![a-z0-9])';

/** One row of plan 0006's item-name keyword table. */
export interface Keyword {
  /** Matched against lower-case text. */
  readonly pattern: RegExp;
  readonly slot: SlotKey;
  /** The slot's code, or how to read it from the match: `Z14` for 14 oz, `3` for 3 compartments. */
  readonly value: string | ((match: RegExpExecArray) => string);
  /** A colour that holds only on paper: kraft is a brown paper, not a brown plastic. */
  readonly paperOnly?: true;
  /**
   * A range, `8-16oz`: each end is read as its own value, with the words it
   * is reported by, so the slot is left not known and both are reported (#58).
   * Replaces `value`.
   */
  readonly ends?: (match: RegExpExecArray) => readonly { readonly value: string; readonly words: string }[];
}

const word = (source: string) => new RegExp(`${BEFORE}(?:${source})${AFTER}`, 'g');
const number = (match: RegExpExecArray) => match[1] ?? '';
const capacityUnit = (unit: string | undefined) => (unit === 'ml' ? 'M' : 'Z');

/**
 * `8-16oz`, `16/24 oz`, `8oz-16oz`, `250 to 500ml`: both ends, each with the
 * unit written after it, or else after the range.
 */
function rangeEnds(match: RegExpExecArray): { value: string; words: string }[] {
  const [, from = '', fromGap = '', fromUnit, to = '', toGap = '', toUnit = ''] = match;
  return [
    { value: `${capacityUnit(fromUnit ?? toUnit)}${from}`, words: fromUnit === undefined ? `${from}${toGap}${toUnit}` : `${from}${fromGap}${fromUnit}` },
    { value: `${capacityUnit(toUnit)}${to}`, words: `${to}${toGap}${toUnit}` },
  ];
}

/**
 * Plan 0006's item-name keywords, in its order: capacity, colour, shape,
 * profile, wall, print, compartments, plies, lid opening, handle, wrap,
 * window and coating.
 */
export const KEYWORDS: readonly Keyword[] = [
  {
    pattern: word('(\\d+(?:\\.\\d+)?)(\\s*)(oz|ml)?\\s*(?:-|–|\\/|to)\\s*(\\d+(?:\\.\\d+)?)(\\s*)(oz|ml)'),
    slot: 'capacity',
    value: '',
    ends: rangeEnds,
  },
  { pattern: word('(\\d+(?:\\.\\d+)?)\\s*oz'), slot: 'capacity', value: (match) => `Z${number(match)}` },
  { pattern: word('(\\d+(?:\\.\\d+)?)\\s*ml'), slot: 'capacity', value: (match) => `M${number(match)}` },
  { pattern: word('clear|transparent'), slot: 'colourClarity', value: 'CL' },
  { pattern: word('white kraft|white'), slot: 'colourClarity', value: 'WH' },
  { pattern: word('black'), slot: 'colourClarity', value: 'BK' },
  { pattern: word('brown|kraft'), slot: 'colourClarity', value: 'BR', paperOnly: true },
  { pattern: word('round'), slot: 'shape', value: 'RD' },
  { pattern: word('square'), slot: 'shape', value: 'SQ' },
  { pattern: word('rectangular'), slot: 'shape', value: 'RC' },
  { pattern: word('oval'), slot: 'shape', value: 'OV' },
  { pattern: word('half[\\s-]*dome'), slot: 'profile', value: 'HD' },
  { pattern: word('dome'), slot: 'profile', value: 'DM' },
  { pattern: word('flat[\\s-]*lid'), slot: 'profile', value: 'FL' },
  // "SW" and "DW" are how suppliers shorten single and double wall.
  { pattern: word('single[\\s-]*wall|sw'), slot: 'wall', value: 'SW' },
  { pattern: word('double[\\s-]*wall|dw'), slot: 'wall', value: 'DW' },
  { pattern: word('ripple(?:[\\s-]*wall)?'), slot: 'wall', value: 'RW' },
  { pattern: word('no[\\s-]*print|unprinted'), slot: 'print', value: 'NP' },
  // "2-3 color" is a range, so neither end is stored. It must be longer than the single count below.
  {
    pattern: word('(\\d+)\\s*(?:-|–|/)\\s*(\\d+)[\\s-]*colou?rs?(?:[\\s-]*print(?:ed|ing)?)?'),
    slot: 'print',
    value: '',
    ends: (match) => [
      { value: (match[1] ?? '').padStart(2, '0'), words: `${match[1]} colour` },
      { value: (match[2] ?? '').padStart(2, '0'), words: `${match[2]} colour` },
    ],
  },
  // "3-color" alone is a print colour count, as "3-color print" is (#58).
  { pattern: word('(\\d+)[\\s-]*colou?rs?(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: (match) => number(match).padStart(2, '0') },
  // "1c" to "8c", as suppliers write a colour count: "(1c print)", "2c".
  { pattern: word('([1-8])c(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: (match) => number(match).padStart(2, '0') },
  { pattern: word('full[\\s-]*colou?r(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: 'FC' },
  { pattern: word('(\\d+)[\\s-]*compartments?'), slot: 'compartments', value: number },
  { pattern: word('(\\d+)[\\s-]*comp'), slot: 'compartments', value: number },
  { pattern: word('(\\d+)[\\s-]*ply'), slot: 'plies', value: number },
  { pattern: word('sip|strawless'), slot: 'lidOpening', value: 'SP' },
  { pattern: word('straw[\\s-]*hole|x[\\s-]*cross|cross[\\s-]*cut'), slot: 'lidOpening', value: 'SH' },
  { pattern: word('twisted[\\s-]*handle'), slot: 'handle', value: 'TW' },
  { pattern: word('flat[\\s-]*handle'), slot: 'handle', value: 'FT' },
  { pattern: word('t[\\s-]*shirt|vest'), slot: 'handle', value: 'TS' },
  { pattern: word('no[\\s-]*handle|sos'), slot: 'handle', value: 'NH' },
  { pattern: word('paper[\\s-]*wrapped'), slot: 'wrap', value: 'PW' },
  { pattern: word('(?:plastic|film)[\\s-]*wrapped'), slot: 'wrap', value: 'FW' },
  { pattern: word('window'), slot: 'window', value: 'WN' },
  { pattern: word('cpet'), slot: 'coating', value: 'CP' },
  { pattern: word('pla[\\s-]*lined'), slot: 'coating', value: 'PL' },
  { pattern: word('grease[\\s-]*resistant'), slot: 'coating', value: 'GR' },
  { pattern: word('uncoated'), slot: 'coating', value: 'NC' },
  // A `+` is its own edge: "280gsm+18gpe+18gpe" holds the coating after the weight.
  { pattern: /(?<![a-z0-9])(?:double[\s-]*pe|2pe)(?![a-z0-9])|\+2pe(?![a-z0-9])|\+\d+gpe\+\d+gpe(?![a-z0-9])/g, slot: 'coating', value: 'PB' },
  { pattern: /(?<![a-z0-9])(?:single[\s-]*pe|1pe|pe[\s-]*coating)(?![a-z0-9])|\+1pe(?![a-z0-9])|\+\d+gpe(?![a-z0-9+])/g, slot: 'coating', value: 'PU' },
];
