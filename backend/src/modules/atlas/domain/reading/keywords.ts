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
}

const word = (source: string) => new RegExp(`${BEFORE}(?:${source})${AFTER}`, 'g');
const number = (match: RegExpExecArray) => match[1] ?? '';

/**
 * Plan 0006's item-name keywords, in its order: capacity, colour, shape,
 * profile, wall, print, compartments, plies, lid opening, handle, wrap,
 * window and coating.
 */
export const KEYWORDS: readonly Keyword[] = [
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
  { pattern: word('single[\\s-]*wall'), slot: 'wall', value: 'SW' },
  { pattern: word('double[\\s-]*wall'), slot: 'wall', value: 'DW' },
  { pattern: word('ripple(?:[\\s-]*wall)?'), slot: 'wall', value: 'RW' },
  { pattern: word('no[\\s-]*print'), slot: 'print', value: 'NP' },
  { pattern: word('(\\d+)[\\s-]*colou?rs?[\\s-]*print(?:ed)?'), slot: 'print', value: (match) => number(match).padStart(2, '0') },
  { pattern: word('full[\\s-]*colou?r(?:[\\s-]*print(?:ed)?)?'), slot: 'print', value: 'FC' },
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
