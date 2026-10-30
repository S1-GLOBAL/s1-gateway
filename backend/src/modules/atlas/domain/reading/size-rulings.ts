import type { Dictionary } from '../dictionary.js';
import { PRODUCT_TYPE as P, SHAPE } from '../options.js';
import { ROUND_SHAPE } from '../slots.js';
import type { MeasurementInput, SpecIdFactsInput } from '../spec-id.js';

/** #28's rulings for sizes that do not say what they measure. R4 is a trade name, never a size. */
export type Ruling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';

export interface SizeReading {
  readonly facts: Partial<SpecIdFactsInput>;
  readonly ruling: Ruling;
  /** The text the size was read from, as it appears in the text given. */
  readonly words: string;
  /** The same size written again elsewhere, each as it appears: `96MM LIDS, 96mm`. */
  readonly repeats?: readonly string[];
}

/** Product types each ruling reads, as #28's table gives them. */
const R1_TYPES = new Set<string>([P.cup, P.cupLid, P.bowl, P.bowlLid, P.portionCup, P.portionCupLid]);
const R1B_TYPES = new Set<string>([P.cup, P.bowl, P.portionCup]);
const R2_TYPES = new Set<string>([P.cup, P.bowl, P.container, P.portionCup]);
/**
 * #28's R6, and what plan 0011 adds of the products with a length, width and
 * height: fry cartons, containers, pans, plates, container lids and cup
 * carriers, read as a box's are.
 */
const R6_TYPES = new Set<string>([P.takeoutBox, P.foldingCarton, P.shippingBox, P.tray, P.hingedContainer, P.fryCarton, P.container, P.containerWithLid, P.pan, P.plate, P.containerLid, P.cupCarrier]);
const SUP = new Set<string>([P.standUpPouch]);
const BAG = new Set<string>([P.bag]);
/** Of those, the ones whose shape slot applies. Length and width need a shape that is not round. */
const R6_WITH_SHAPE = new Set<string>([P.tray, P.hingedContainer]);
/** The shape R6 names for those. */
const RECTANGULAR = SHAPE.rectangular;

/**
 * A fraction as an inch ruler marks it, halves to sixty-fourths, in lowest
 * terms and under one: `1/8`, `15/16`. "24/32" is two sizes, not a fraction.
 */
const FRACTION =
  '(?:1\\/2|[13]\\/4|[1357]\\/8|(?:1[135]|[13579])\\/16|(?:[12][13579]|31|[13579])\\/32|(?:[1-5][13579]|6[13]|[13579])\\/64)(?!\\d)';
const GLYPHS: Readonly<Record<string, readonly [number, number]>> = {
  '½': [1, 2],
  '¼': [1, 4],
  '¾': [3, 4],
  '⅛': [1, 8],
  '⅜': [3, 8],
  '⅝': [5, 8],
  '⅞': [7, 8],
};
const GLYPH = `[${Object.keys(GLYPHS).join('')}]`;
/** A whole number and a fraction (`20-1/8`, `20 1/8`, `10½`), a fraction alone, or a decimal. */
const NUMBER = `(\\d+[\\s-]+${FRACTION}|\\d*${GLYPH}|${FRACTION}|\\d+(?:\\.\\d+)?)`;
/** A unit a size may be written in; none written is millimetres (ADR 0019), or inches beside a fraction (#58). */
const UNIT = '\\s*(mm|cm|inches|inch|in|"|\'\')?';
const TIMES = '\\s*[x×*]\\s*';
/** A number joined to another by `+` is a layer of something, not a size: `300+300+250` gsm. */
/** Nor is a number joined to a word by a hyphen: "DELI-34" is a model, not a 32 mm rim. */
const EDGE_BEFORE = '(?<![a-z0-9./+])(?<![a-z]-)';
/** No letter, digit, slash or `+` after a number, and no decimal point either: `1.9g` holds no size `1`. */
const EDGE_AFTER = '(?![a-z0-9/+]|\\.\\d)';

const THREE = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}(\\s*dia)?${TIMES}${NUMBER}${UNIT}${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
const DIA_BY = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}\\s*dia${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
/** The words that say a number is a diameter. */
const MARK = '(?:ø|φ|⌀|diameter|dia|rim)';
/** Not the second of two numbers: "90 x 110" is no 110 mm rim. */
const NOT_SECOND = '(?<!\\d\\s*(?:mm|cm|in|")?\\s*[x×*]\\s*)';
/**
 * One number, with "dia", "rim", "ø" or "φ" before or after it, or alone with
 * at most a length unit; a lone number followed by any other word is not a
 * size, nor is the second of two.
 */
const ONE_MARKED_BEFORE = new RegExp(`${MARK}\\s*${EDGE_BEFORE}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
const ONE_MARKED_AFTER = new RegExp(`${NOT_SECOND}${EDGE_BEFORE}${NUMBER}${UNIT}\\s*${MARK}(?![a-z])`, 'g');
const ONE = new RegExp(`${NOT_SECOND}${EDGE_BEFORE}${NUMBER}${UNIT}${EDGE_AFTER}(?!\\s*[a-z])`, 'g');

/**
 * The one-number sizes in `text`, in the order written: those marked as a
 * diameter, when any is, since "95 Dia" says what it measures and a stray
 * "0.5" does not; else the lone ones.
 */
function oneSizes(text: string): RegExpExecArray[] {
  const marked = ([...text.matchAll(ONE_MARKED_BEFORE), ...text.matchAll(ONE_MARKED_AFTER)] as RegExpExecArray[]).sort(
    (left, right) => left.index - right.index,
  );
  return marked.length > 0 ? marked : ([...text.matchAll(ONE)] as RegExpExecArray[]);
}

/** The narrowest and widest rims R1 reads (ADR 0019's R1, plan 0011). */
const RIM_MIN_MM = 30;
const RIM_MAX_MM = 300;
const MM_PER_UNIT: Readonly<Record<string, number>> = { mm: 1, cm: 10, in: 25.4 };

function unitOf(written: string | undefined): string {
  if (written === 'cm') return 'cm';
  if (written === 'in' || written === 'inch' || written === 'inches' || written === '"' || written === "''") return 'in';
  return 'mm';
}

/** A number as a decimal: `20-1/8` and `20⅛` are `20.125`. A ruler's fractions always end within six places. */
function decimalOf(written: string): string {
  const fraction = /(\d+)\/(\d+)$/.exec(written) ?? new RegExp(`(${GLYPH})$`).exec(written);
  if (!fraction) return written;
  const [numerator, denominator] =
    fraction[2] === undefined ? (GLYPHS[fraction[1] ?? ''] ?? [0, 1]) : [Number(fraction[1]), Number(fraction[2])];
  const whole = Number(/^\d+/.exec(written.slice(0, fraction.index))?.[0] ?? '0');
  return String(whole + numerator / denominator);
}

const hasFraction = (written: string | undefined) => written !== undefined && new RegExp(`\\/|${GLYPH}`).test(written);

/**
 * The three-number sizes in `text`, one with its unit written before one
 * without, as an item name's "10 x 7 x 12 in" is read over a Dimension cell's
 * "10 x 7 x 12"; else in the order written. One with no unit is still
 * millimetres (#58).
 */
function threeSizes(text: string): RegExpExecArray[] {
  const found = [...text.matchAll(THREE)] as RegExpExecArray[];
  const written = (match: RegExpExecArray) => (match[2] ?? match[5] ?? match[7]) !== undefined;
  return [...found.filter(written), ...found.filter((match) => !written(match))];
}

/**
 * Numbers with their units; a number with no unit takes the last unit
 * written, else inches when any number has a fraction (only inches are
 * written with fractions, #58), else mm.
 */
function measures(values: readonly (string | undefined)[], units: readonly (string | undefined)[]): MeasurementInput[] {
  const last = [...units].reverse().find((unit) => unit !== undefined) ?? (values.some(hasFraction) ? 'in' : undefined);
  return values.map((value, index) => ({ value: decimalOf(value ?? ''), unit: unitOf(units[index] ?? last) }));
}

/**
 * The shape a product with a named length and width has, as R6 names it: a
 * tray's or a hinged container's is rectangular. Undefined for any other.
 */
export function shapeOfLengthAndWidth(productType: string, dictionary: Dictionary): string | undefined {
  const named = [...R6_WITH_SHAPE].some((type) => dictionary.live('productType', type) === productType);
  return named ? dictionary.live('shape', RECTANGULAR) : undefined;
}

/**
 * The size in `text` for `productType`, by #28's rulings, or null when no
 * ruling reads it. `text` is lower case, with the words other rules used
 * already blanked out. The rulings name product types and shapes in S2
 * 0.1.0's letters, and read them in `dictionary`'s (ADR 0031).
 */
export function readSize(text: string, productType: string, dictionary: Dictionary): SizeReading | null {
  const is = (types: ReadonlySet<string>) => [...types].some((type) => dictionary.live('productType', type) === productType);
  const round = dictionary.live('shape', ROUND_SHAPE) ?? ROUND_SHAPE;
  const rectangular = dictionary.live('shape', RECTANGULAR);
  const threes = threeSizes(text);
  // The size written again, "304.8 x 152.4 x 508 mm (12 x 6 x 20 in)", is that size, so none of it is left over.
  const again = (chosen: RegExpExecArray) => {
    const repeats = threes.filter((other) => other !== chosen).map((other) => other[0].trim());
    return repeats.length > 0 ? { repeats } : {};
  };
  for (const match of threes) {
    const [words, a, ua, dia, b, ub, c, uc] = match;
    const [x, y, z] = measures([a, b, c], [ua, ub, uc]) as [MeasurementInput, MeasurementInput, MeasurementInput];
    const n = (m: MeasurementInput) => Number.parseFloat(m.value);
    if (dia !== undefined) {
      if (is(R2_TYPES) && n(y) < n(x)) {
        return { facts: { shape: round, topDiameter: x, bottomDiameter: y, height: z }, ruling: 'R2', words, ...again(match) };
      }
      return null;
    }
    if (is(SUP) && n(z) < n(x) && n(z) < n(y)) {
      return { facts: { width: x, height: y, gusset: z }, ruling: 'R3', words, ...again(match) };
    }
    if (is(BAG) && n(y) < n(x) && n(y) < n(z)) {
      return { facts: { width: x, gusset: y, height: z }, ruling: 'R5', words, ...again(match) };
    }
    if (is(R6_TYPES)) {
      // A tray or a hinged container cannot keep a length until its shape is
      // not round, so the ruling names it rectangular, while that option
      // exists. readText leaves a shape the text already gave.
      const facts: Partial<SpecIdFactsInput> =
        is(R6_WITH_SHAPE) && rectangular !== undefined
          ? { shape: rectangular, length: x, width: y, height: z }
          : { length: x, width: y, height: z };
      return { facts, ruling: 'R6', words, ...again(match) };
    }
    return null;
  }
  for (const match of text.matchAll(DIA_BY)) {
    if (!is(R1B_TYPES)) return null;
    const [words, a, ua, b, ub] = match;
    const [x, y] = measures([a, b], [ua, ub]) as [MeasurementInput, MeasurementInput];
    return { facts: { shape: round, topDiameter: x, height: y }, ruling: 'R1b', words };
  }
  if (!is(R1_TYPES)) return null;
  // One size, though it may be written more than once, as an item name and its Dimension column both do.
  const ones = oneSizes(text);
  const sizes = ones.map(([, value, unit]) => measures([value], [unit])[0] as MeasurementInput);
  const [rim] = sizes;
  if (rim === undefined || sizes.some((size) => size.value !== rim.value || size.unit !== rim.unit)) return null;
  // No cup, bowl or lid is wider or narrower than these: "500 paper bowl" is no rim, but likely 500 mL, which is never guessed.
  const millimetres = Number(rim.value) * (MM_PER_UNIT[rim.unit] ?? 1);
  if (millimetres > RIM_MAX_MM || millimetres < RIM_MIN_MM) return null;
  const [words, ...repeats] = ones.map(([written]) => written.trim()) as [string, ...string[]];
  return { facts: { shape: round, topDiameter: rim }, ruling: 'R1', words, ...(repeats.length > 0 ? { repeats } : {}) };
}
