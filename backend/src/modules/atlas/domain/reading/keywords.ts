import { CAPACITY_UNIT, COATING, COLOUR_CLARITY, HANDLE, LID_OPENING, PRINT, PROFILE, SHAPE, WALL, WINDOW, WRAP } from '../options.js';
import type { SlotKey } from '../slots.js';

const PRINT_COLOURS: Readonly<Record<number, string>> = {
  1: PRINT.oneColour,
  2: PRINT.twoColours,
  3: PRINT.threeColours,
  4: PRINT.fourColours,
  5: PRINT.fiveColours,
  6: PRINT.sixColours,
  7: PRINT.sevenColours,
  8: PRINT.eightColours,
};

/** Edges of a whole word: no letter or digit just before or after (ADR 0026). */
const BEFORE = '(?<![a-z0-9])';
const AFTER = '(?![a-z0-9])';

/** One row of plan 0006's item-name keyword table. */
export interface Keyword {
  /** Matched against lower-case text. */
  readonly pattern: RegExp;
  readonly slot: SlotKey;
  /** The slot's value, or how to read it from the match: `114` for 14 oz, unit 1, `3` for 3 compartments. */
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
const capacityUnit = (unit: string | undefined) => (unit === 'ml' ? CAPACITY_UNIT.millilitres : CAPACITY_UNIT.ounces);
/** A print's colour count as its option: 1 to 8 colours; any other count is no option, for the build to refuse. */
const colours = (count: string): string => PRINT_COLOURS[Number(count)] ?? `${count} colours`;

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
  { pattern: word('(\\d+(?:\\.\\d+)?)\\s*oz'), slot: 'capacity', value: (match) => `${CAPACITY_UNIT.ounces}${number(match)}` },
  { pattern: word('(\\d+(?:\\.\\d+)?)\\s*ml'), slot: 'capacity', value: (match) => `${CAPACITY_UNIT.millilitres}${number(match)}` },
  { pattern: word('clear|transparent'), slot: 'colourClarity', value: COLOUR_CLARITY.clear },
  { pattern: word('white kraft|white'), slot: 'colourClarity', value: COLOUR_CLARITY.white },
  { pattern: word('black'), slot: 'colourClarity', value: COLOUR_CLARITY.black },
  { pattern: word('brown|kraft'), slot: 'colourClarity', value: COLOUR_CLARITY.brown, paperOnly: true },
  { pattern: word('round'), slot: 'shape', value: SHAPE.round },
  { pattern: word('square'), slot: 'shape', value: SHAPE.square },
  { pattern: word('rectangular'), slot: 'shape', value: SHAPE.rectangular },
  { pattern: word('oval'), slot: 'shape', value: SHAPE.oval },
  { pattern: word('half[\\s-]*dome'), slot: 'profile', value: PROFILE.halfDome },
  { pattern: word('dome'), slot: 'profile', value: PROFILE.dome },
  // "Flat lid", "Flat PP Lids", "paper cup lid - Flat": flat beside a lid, as "dome" is anywhere.
  {
    pattern: word('flat(?=(?:[\\s-]+[a-z0-9]+){0,3}?[\\s-]+lids?(?![a-z]))|(?<=lids?(?:[\\s-]+[a-z0-9]+){0,3}?[\\s-]+)flat'),
    slot: 'profile',
    value: PROFILE.flat,
  },
  // "SW" and "DW" are how suppliers shorten single and double wall.
  { pattern: word('single[\\s-]*wall|sw'), slot: 'wall', value: WALL.singleWall },
  { pattern: word('double[\\s-]*wall|dw'), slot: 'wall', value: WALL.doubleWall },
  { pattern: word('ripple(?:[\\s-]*wall)?'), slot: 'wall', value: WALL.rippleWall },
  { pattern: word('no[\\s-]*print|unprinted'), slot: 'print', value: PRINT.noPrint },
  // "2-3 color" is a range, so neither end is stored. It must be longer than the single count below.
  {
    pattern: word('(\\d+)\\s*(?:-|–|/)\\s*(\\d+)[\\s-]*colou?rs?(?:[\\s-]*print(?:ed|ing)?)?'),
    slot: 'print',
    value: '',
    ends: (match) => [
      { value: colours(match[1] ?? ''), words: `${match[1]} colour` },
      { value: colours(match[2] ?? ''), words: `${match[2]} colour` },
    ],
  },
  // "3-color" alone is a print colour count, as "3-color print" is (#58).
  { pattern: word('(\\d+)[\\s-]*colou?rs?(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: (match) => colours(number(match)) },
  // "1c" to "8c", as suppliers write a colour count: "(1c print)", "2c".
  { pattern: word('([1-8])c(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: (match) => colours(number(match)) },
  { pattern: word('full[\\s-]*colou?r(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: PRINT.fullColour },
  { pattern: word('(\\d+)[\\s-]*compartments?'), slot: 'compartments', value: number },
  { pattern: word('(\\d+)[\\s-]*comp'), slot: 'compartments', value: number },
  { pattern: word('(\\d+)[\\s-]*ply'), slot: 'plies', value: number },
  { pattern: word('sip|strawless'), slot: 'lidOpening', value: LID_OPENING.sipThrough },
  { pattern: word('straw[\\s-]*hole|x[\\s-]*cross|cross[\\s-]*cut'), slot: 'lidOpening', value: LID_OPENING.strawHole },
  // "Twisted handle", "twist handle", "twisted paper bag": a twist is the handle's, but a twist tie is not.
  { pattern: word('twist(?:ed)?(?:[\\s-]+(?:paper[\\s-]+)?handle[sd]?)?(?![\\s-]*ties?(?![a-z]))'), slot: 'handle', value: HANDLE.twisted },
  { pattern: word('flat[\\s-]*handle'), slot: 'handle', value: HANDLE.flatTape },
  { pattern: word('t[\\s-]*shirt|vest'), slot: 'handle', value: HANDLE.tShirt },
  { pattern: word('no[\\s-]*handle|sos'), slot: 'handle', value: HANDLE.noHandle },
  { pattern: word('no[\\s-]*wrap(?:per|ped|ping)?|unwrapped|not[\\s-]*wrapped|without[\\s-]*wrap(?:per|ping)?'), slot: 'wrap', value: WRAP.notWrapped },
  { pattern: word('paper[\\s-]*wrapped'), slot: 'wrap', value: WRAP.paperWrapped },
  { pattern: word('(?:plastic|film)[\\s-]*wrapped'), slot: 'wrap', value: WRAP.filmWrapped },
  { pattern: word('window'), slot: 'window', value: WINDOW.withWindow },
  { pattern: word('powder[\\s-]*free'), slot: 'coating', value: COATING.powderFree },
  { pattern: word('powdered'), slot: 'coating', value: COATING.powdered },
  { pattern: word('cpet'), slot: 'coating', value: COATING.cpetCoated },
  { pattern: word('pla[\\s-]*lined'), slot: 'coating', value: COATING.plaLined },
  { pattern: word('grease[\\s-]*resistant'), slot: 'coating', value: COATING.greaseResistant },
  { pattern: word('uncoated'), slot: 'coating', value: COATING.noCoating },
  // A `+` is its own edge: "280gsm+18gpe+18gpe" holds the coating after the weight.
  { pattern: /(?<![a-z0-9])(?:double[\s-]*pe|2pe)(?![a-z0-9])|\+2pe(?![a-z0-9])|\+\d+gpe\+\d+gpe(?![a-z0-9])/g, slot: 'coating', value: COATING.peBothSides },
  { pattern: /(?<![a-z0-9])(?:single[\s-]*pe|1pe|pe[\s-]*coating)(?![a-z0-9])|\+1pe(?![a-z0-9])|\+\d+gpe(?![a-z0-9+])/g, slot: 'coating', value: COATING.peSideNotStated },
];
