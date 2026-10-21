import type { MeasurementInput, SpecIdFactsInput } from '../spec-id.js';

/** #28's rulings for sizes that do not say what they measure. R4 is a trade name, never a size. */
export type Ruling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';

export interface SizeReading {
  readonly facts: Partial<SpecIdFactsInput>;
  readonly ruling: Ruling;
  /** The text the size was read from, as it appears in the text given. */
  readonly words: string;
}

/** Product types each ruling reads, as #28's table gives them. */
const R1_TYPES = new Set(['CUP', 'CLD', 'BWL', 'BLD', 'PCP', 'PCL']);
const R1B_TYPES = new Set(['CUP', 'BWL', 'PCP']);
const R2_TYPES = new Set(['CUP', 'BWL', 'CTN', 'PCP']);
const R6_TYPES = new Set(['TKB', 'FCB', 'RSC', 'TRY', 'HCT']);
/** Of those, the ones whose shape slot applies. Length and width need a shape that is not round. */
const R6_WITH_SHAPE = new Set(['TRY', 'HCT']);

const NUMBER = '(\\d+(?:\\.\\d+)?)';
/** A unit a size may be written in; none written is millimetres (ADR 0019). */
const UNIT = '\\s*(mm|cm|inches|inch|in|")?';
const TIMES = '\\s*[x×*]\\s*';
const EDGE_BEFORE = '(?<![a-z0-9.])';
const EDGE_AFTER = '(?![a-z0-9])';

const THREE = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}(\\s*dia)?${TIMES}${NUMBER}${UNIT}${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
const DIA_BY = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}\\s*dia${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
/** One number, alone or with "dia", "rim", "ø" or a length unit; a number followed by any other word is not a size. */
const ONE = new RegExp(`(?:(?:ø|dia|rim)\\s*)?${EDGE_BEFORE}${NUMBER}${UNIT}(?:\\s*(?:dia|rim))?${EDGE_AFTER}(?!\\s*[a-z])`, 'g');

function unitOf(written: string | undefined): string {
  if (written === 'cm') return 'cm';
  if (written === 'in' || written === 'inch' || written === 'inches' || written === '"') return 'in';
  return 'mm';
}

/** Numbers with their units; a number with no unit takes the last unit written, else mm. */
function measures(values: readonly (string | undefined)[], units: readonly (string | undefined)[]): MeasurementInput[] {
  const last = [...units].reverse().find((unit) => unit !== undefined);
  return values.map((value, index) => ({ value: value ?? '', unit: unitOf(units[index] ?? last) }));
}

/**
 * The size in `text` for `productType`, by #28's rulings, or null when no
 * ruling reads it. `text` is lower case, with the words other rules used
 * already blanked out.
 */
export function readSize(text: string, productType: string): SizeReading | null {
  for (const match of text.matchAll(THREE)) {
    const [words, a, ua, dia, b, ub, c, uc] = match;
    const [x, y, z] = measures([a, b, c], [ua, ub, uc]) as [MeasurementInput, MeasurementInput, MeasurementInput];
    const n = (m: MeasurementInput) => Number.parseFloat(m.value);
    if (dia !== undefined) {
      if (R2_TYPES.has(productType) && n(y) < n(x)) {
        return { facts: { shape: 'RD', topDiameter: x, bottomDiameter: y, height: z }, ruling: 'R2', words };
      }
      return null;
    }
    if (productType === 'SUP' && n(z) < n(x) && n(z) < n(y)) {
      return { facts: { width: x, height: y, gusset: z }, ruling: 'R3', words };
    }
    if (productType === 'BAG' && n(y) < n(x) && n(y) < n(z)) {
      return { facts: { width: x, gusset: y, height: z }, ruling: 'R5', words };
    }
    if (R6_TYPES.has(productType)) {
      // A tray or a hinged container cannot keep a length until its shape is
      // not round, so the ruling names it rectangular. readText leaves a shape
      // the text already gave.
      const facts: Partial<SpecIdFactsInput> = R6_WITH_SHAPE.has(productType)
        ? { shape: 'RC', length: x, width: y, height: z }
        : { length: x, width: y, height: z };
      return { facts, ruling: 'R6', words };
    }
    return null;
  }
  for (const match of text.matchAll(DIA_BY)) {
    if (!R1B_TYPES.has(productType)) return null;
    const [words, a, ua, b, ub] = match;
    const [x, y] = measures([a, b], [ua, ub]) as [MeasurementInput, MeasurementInput];
    return { facts: { shape: 'RD', topDiameter: x, height: y }, ruling: 'R1b', words };
  }
  if (!R1_TYPES.has(productType)) return null;
  const ones = [...text.matchAll(ONE)];
  if (ones.length !== 1) return null;
  const [match] = ones as [RegExpExecArray];
  const [words, value, unit] = match;
  return { facts: { shape: 'RD', topDiameter: { value: value ?? '', unit: unitOf(unit) } }, ruling: 'R1', words: words.trim() };
}
