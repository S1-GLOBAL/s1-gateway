import type { Dictionary } from '../dictionary.js';
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

/** Product types each ruling reads, as #28's table gives them, in S2 0.1.0's letters. */
const R1_TYPES = new Set(['CUP', 'CLD', 'BWL', 'BLD', 'PCP', 'PCL']);
const R1B_TYPES = new Set(['CUP', 'BWL', 'PCP']);
const R2_TYPES = new Set(['CUP', 'BWL', 'CTN', 'PCP']);
const R6_TYPES = new Set(['TKB', 'FCB', 'RSC', 'TRY', 'HCT']);
const SUP = new Set(['SUP']);
const BAG = new Set(['BAG']);
/** Of those, the ones whose shape slot applies. Length and width need a shape that is not round. */
const R6_WITH_SHAPE = new Set(['TRY', 'HCT']);
/** The shape R6 names for those, in S2 0.1.0's letters. */
const RECTANGULAR = 'RC';

/** A fraction as an inch ruler marks it, halves to sixty-fourths: `1/8`. */
const FRACTION = '\\d{1,2}\\/(?:2|4|8|16|32|64)(?!\\d)';
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
const UNIT = '\\s*(mm|cm|inches|inch|in|")?';
const TIMES = '\\s*[x×*]\\s*';
/** A number joined to another by `+` is a layer of something, not a size: `300+300+250` gsm. */
const EDGE_BEFORE = '(?<![a-z0-9./+])';
/** No letter, digit, slash or `+` after a number, and no decimal point either: `1.9g` holds no size `1`. */
const EDGE_AFTER = '(?![a-z0-9/+]|\\.\\d)';

const THREE = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}(\\s*dia)?${TIMES}${NUMBER}${UNIT}${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
const DIA_BY = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}\\s*dia${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
/** One number, alone or with "dia", "rim", "ø" or a length unit; a number followed by any other word is not a size. */
const ONE = new RegExp(`(?:(?:ø|dia|rim)\\s*)?${EDGE_BEFORE}${NUMBER}${UNIT}(?:\\s*(?:dia|rim))?${EDGE_AFTER}(?!\\s*[a-z])`, 'g');

function unitOf(written: string | undefined): string {
  if (written === 'cm') return 'cm';
  if (written === 'in' || written === 'inch' || written === 'inches' || written === '"') return 'in';
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
 * Numbers with their units; a number with no unit takes the last unit
 * written, else inches when any number has a fraction (only inches are
 * written with fractions, #58), else mm.
 */
function measures(values: readonly (string | undefined)[], units: readonly (string | undefined)[]): MeasurementInput[] {
  const last = [...units].reverse().find((unit) => unit !== undefined) ?? (values.some(hasFraction) ? 'in' : undefined);
  return values.map((value, index) => ({ value: decimalOf(value ?? ''), unit: unitOf(units[index] ?? last) }));
}

/**
 * The size in `text` for `productType`, by #28's rulings, or null when no
 * ruling reads it. `text` is lower case, with the words other rules used
 * already blanked out. The rulings name product types and shapes in S2
 * 0.1.0's letters, and read them in `dictionary`'s (ADR 0031).
 */
export function readSize(text: string, productType: string, dictionary: Dictionary): SizeReading | null {
  const is = (types: ReadonlySet<string>) => [...types].some((type) => dictionary.liveOriginal('productType', type) === productType);
  const round = dictionary.liveOriginal('shape', ROUND_SHAPE) ?? ROUND_SHAPE;
  const rectangular = dictionary.liveOriginal('shape', RECTANGULAR);
  for (const match of text.matchAll(THREE)) {
    const [words, a, ua, dia, b, ub, c, uc] = match;
    const [x, y, z] = measures([a, b, c], [ua, ub, uc]) as [MeasurementInput, MeasurementInput, MeasurementInput];
    const n = (m: MeasurementInput) => Number.parseFloat(m.value);
    if (dia !== undefined) {
      if (is(R2_TYPES) && n(y) < n(x)) {
        return { facts: { shape: round, topDiameter: x, bottomDiameter: y, height: z }, ruling: 'R2', words };
      }
      return null;
    }
    if (is(SUP) && n(z) < n(x) && n(z) < n(y)) {
      return { facts: { width: x, height: y, gusset: z }, ruling: 'R3', words };
    }
    if (is(BAG) && n(y) < n(x) && n(y) < n(z)) {
      return { facts: { width: x, gusset: y, height: z }, ruling: 'R5', words };
    }
    if (is(R6_TYPES)) {
      // A tray or a hinged container cannot keep a length until its shape is
      // not round, so the ruling names it rectangular, while that option
      // exists. readText leaves a shape the text already gave.
      const facts: Partial<SpecIdFactsInput> =
        is(R6_WITH_SHAPE) && rectangular !== undefined
          ? { shape: rectangular, length: x, width: y, height: z }
          : { length: x, width: y, height: z };
      return { facts, ruling: 'R6', words };
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
  const ones = [...text.matchAll(ONE)];
  const sizes = ones.map(([, value, unit]) => measures([value], [unit])[0] as MeasurementInput);
  const [rim] = sizes;
  if (rim === undefined || sizes.some((size) => size.value !== rim.value || size.unit !== rim.unit)) return null;
  const [words, ...repeats] = ones.map(([written]) => written.trim()) as [string, ...string[]];
  return { facts: { shape: round, topDiameter: rim }, ruling: 'R1', words, ...(repeats.length > 0 ? { repeats } : {}) };
}
