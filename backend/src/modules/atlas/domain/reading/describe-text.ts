import { buildKeepingWhatFits } from '../build-keeping-what-fits.js';
import type { Dictionary } from '../dictionary.js';
import { fraction, multiply, readDecimal, roundHalfUp, type Fraction } from '../measurement.js';
import { SLOTS, slotDefinition, type MeasureSlotKey, type SlotKey } from '../slots.js';
import type { MeasurementInput, SpecIdFactsInput } from '../spec-id-facts.js';
import { meaningOfFact, type SpecId } from '../spec-id.js';
import { combinationFor, lidFits } from './combined-products.js';
import { combineAdjacent, conflictLine, productIncludedWith, readIssuedMeanings, readNamedMeasures, suggestionsFor } from './notes.js';
import { readText, type TextReading } from './read-text.js';

/** What a product description says, kept to the facts its product has (ADR 0026, ADR 0032). */
export interface TextDescription {
  /** The code the kept facts make; null without a product type. */
  readonly specId: SpecId | null;
  /** The facts kept, each size in the unit its slot stores. */
  readonly facts: Partial<SpecIdFactsInput>;
  /** The reader's own reading, with the product type as these passes settled it. */
  readonly reading: TextReading;
  /** For each size converted into its slot's unit: ` (converted from 9 inch)`. */
  readonly conversions: ReadonlyMap<SlotKey, string>;
  /** Sentences about what was read, left out, or could still be meant, in the order they arose. */
  readonly notes: readonly string[];
  /** The words nothing used, nor any note explains. */
  readonly ignored: readonly string[];
}

/**
 * Reads a product description the way Atlas reads text (ADR 0026), then
 * passes the plan 0011 reader adds: a lid named by what it fits, a vessel
 * sold with its lid, two values for one fact, words that together name one
 * option, a size written beside its name. A range is not a fact. A size in
 * another unit is converted into the unit its slot stores, and says so.
 */
export function describeText(text: string, dictionary: Dictionary, productType?: string): TextDescription {
  const read = readText(text, dictionary, productType);
  const fitted = lidFits(text);
  const fittedCode =
    fitted !== undefined && dictionary.meaningOf('productType', fitted.code) !== undefined ? fitted.code : undefined;
  const included = fittedCode === undefined ? productIncludedWith(text, read, dictionary) : undefined;
  const base = fittedCode ?? included?.code ?? (typeof read.facts.productType === 'string' ? read.facts.productType : undefined);
  const paired = fittedCode === undefined ? combinationFor(text, base) : undefined;
  const chosen = paired !== undefined && dictionary.meaningOf('productType', paired) !== undefined ? paired : undefined;
  const settled = chosen ?? fittedCode ?? included?.code;
  const drops = [...(included?.drop ?? []), ...(fittedCode !== undefined ? (fitted?.drop ?? []) : [])];
  const reading: TextReading =
    settled === undefined
      ? read
      : {
          ...read,
          facts: { ...read.facts, productType: settled },
          conflicts: read.conflicts.filter((conflict) => conflict.key !== 'productType'),
          ignored: drops.length === 0 ? read.ignored : withoutWords(read.ignored, drops),
        };

  const notes = reading.conflicts.map((conflict) => conflictLine(conflict.key, conflict.found, dictionary));
  if (included !== undefined && chosen === undefined) notes.unshift(included.note);
  if (fitted !== undefined && fittedCode !== undefined && chosen === undefined) {
    const meaning = dictionary.meaningOf('productType', fittedCode) ?? fittedCode;
    const number = dictionary.numberOf('productType', fittedCode);
    const label = number === undefined ? meaning : `${meaning} (A${number})`;
    notes.unshift(`The product is the lid. It goes on ${articleBefore(fitted.fits)} ${fitted.fits}. It is ${articleBefore(label)} ${label}.`);
  }

  const combined = combineAdjacent(text, reading, dictionary);
  notes.push(...combined.warnings);
  const issued = readIssuedMeanings(
    text,
    { ...reading, facts: { ...reading.facts, ...combined.facts }, ignored: combined.ignored },
    dictionary,
  );
  notes.push(
    ...(fitted === undefined || fittedCode === undefined
      ? issued.warnings
      : issued.warnings.filter((note) => !note.startsWith('Product type') || !note.toLowerCase().includes(fitted.vessel.toLowerCase()))),
  );
  const named = readNamedMeasures(
    text,
    { ...reading, facts: { ...reading.facts, ...combined.facts, ...issued.facts }, ignored: issued.ignored },
    dictionary,
  );
  notes.push(...named.warnings);

  const facts: Record<string, unknown> = { ...reading.facts, ...combined.facts, ...issued.facts, ...named.facts };
  const conversions = new Map<SlotKey, string>();
  for (const key of Object.keys(STORED_UNIT) as MeasureSlotKey[]) {
    const fact = facts[key] as MeasurementInput | undefined;
    if (fact === undefined || fact.unit === STORED_UNIT[key]) continue;
    const converted = converting(key, fact);
    if (converted === undefined) {
      notes.push(`${slotDefinition(key).name} is in ${UNIT_NAMES[key]}. ${fact.value} ${fact.unit} was not stored.`);
      delete facts[key];
      continue;
    }
    conversions.set(key, ` (converted from ${fact.value} ${fact.unit === 'in' ? 'inch' : fact.unit})`);
    facts[key] = converted;
  }

  const kept = buildKeepingWhatFits(facts as Partial<SpecIdFactsInput>, dictionary);
  for (const dropped of kept.dropped) {
    const name = slotDefinition(dropped.key).name;
    if (notes.some((note) => note.startsWith(`${name} does not apply`))) continue;
    const reason = dropped.reasons[0];
    notes.push(reason === undefined ? `${name} was left out.` : `${name} was left out. ${reason}`);
  }
  const suggested = suggestionsFor({ ...reading, ignored: named.ignored }, kept.facts, dictionary, text);
  notes.push(...suggested.suggestions);
  // "Printed 500 paper bowl": likely 500 mL, but a number with no unit is never stored as one.
  const capacityOpen =
    kept.specId !== null && kept.facts.capacity == null && kept.specId.slot('capacity') !== 'X';
  for (const bare of capacityOpen ? suggested.ignored.filter((word) => /^\d{2,4}$/.test(word)) : []) {
    notes.push(`${bare} has no unit. If it is the capacity, write ${bare} ml or ${bare} oz.`);
  }
  return { specId: kept.specId, facts: kept.facts, reading, conversions, notes, ignored: suggested.ignored };
}

/** One fact a description kept, in plain words. */
export interface FactInWords {
  readonly key: SlotKey;
  readonly name: string;
  /** As the slot reads in a decoded code, and what it was converted from: `229 mm (converted from 9 inch)`. */
  readonly meaning: string;
}

/** Each fact a description kept, in slot order, as its code reads them; before there is a code, each on its own. */
export function factsInWords(description: TextDescription, dictionary: Dictionary): FactInWords[] {
  const withConversion = (key: SlotKey, meaning: string) => `${meaning}${description.conversions.get(key) ?? ''}`;
  if (description.specId !== null) {
    return description.specId
      .describe(dictionary)
      .filter((slot) => slot.state === 'value')
      .map(({ key, name, meaning }) => ({ key, name, meaning: withConversion(key, meaning) }));
  }
  return SLOTS.flatMap(({ key, name }) => {
    const fact = key === 'variant' ? undefined : description.facts[key];
    const meaning = fact == null ? undefined : meaningOfFact(key, fact, dictionary);
    return meaning === undefined ? [] : [{ key, name, meaning: withConversion(key, meaning) }];
  });
}

/** The unit each size slot stores. */
const STORED_UNIT: Readonly<Record<MeasureSlotKey, string>> = {
  topDiameter: 'mm',
  bottomDiameter: 'mm',
  height: 'mm',
  length: 'mm',
  width: 'mm',
  gusset: 'mm',
  unitWeight: 'g',
  basisWeight: 'gsm',
  thickness: 'um',
};

const UNIT_NAMES: Readonly<Record<MeasureSlotKey, string>> = {
  topDiameter: 'millimetres',
  bottomDiameter: 'millimetres',
  height: 'millimetres',
  length: 'millimetres',
  width: 'millimetres',
  gusset: 'millimetres',
  unitWeight: 'grams',
  basisWeight: 'gsm',
  thickness: 'micrometres',
};

/**
 * A size in the unit its slot stores: centimetres and inches into millimetres,
 * rounded half up; millimetres, centimetres and inches of thickness into
 * micrometres; kilograms into grams, to 6 decimal places. Undefined for any
 * other unit.
 */
function converting(slot: MeasureSlotKey, fact: MeasurementInput): MeasurementInput | undefined {
  const stored = STORED_UNIT[slot];
  if (stored === 'mm' && (fact.unit === 'cm' || fact.unit === 'in')) {
    const millimetres = rounded(fact.value, fact.unit === 'cm' ? fraction(10n, 1n) : fraction(254n, 10n));
    return millimetres === undefined ? undefined : { value: millimetres, unit: 'mm' };
  }
  if (stored === 'um' && (fact.unit === 'mm' || fact.unit === 'cm' || fact.unit === 'in')) {
    const factor = fact.unit === 'mm' ? fraction(1000n, 1n) : fact.unit === 'cm' ? fraction(10000n, 1n) : fraction(25400n, 1n);
    const micrometres = rounded(fact.value, factor);
    return micrometres === undefined ? undefined : { value: micrometres, unit: 'um' };
  }
  if (stored === 'g' && fact.unit === 'kg') {
    const grams = scaled(fact.value, fraction(1000n, 1n));
    return grams === undefined ? undefined : { value: grams, unit: 'g' };
  }
  return undefined;
}

function rounded(value: string, factor: Fraction): string | undefined {
  const reading = readDecimal(value);
  return reading.ok ? roundHalfUp(multiply(reading.value, factor)).toString() : undefined;
}

function scaled(value: string, factor: Fraction): string | undefined {
  const reading = readDecimal(value);
  if (!reading.ok) return undefined;
  const product = multiply(reading.value, factor);
  const whole = product.numerator / product.denominator;
  const remainder = product.numerator % product.denominator;
  if (remainder === 0n) return whole.toString();
  const digits = ((remainder * 1_000_000n) / product.denominator).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${digits}`;
}

function articleBefore(text: string): 'a' | 'an' {
  const word = text.trim();
  return /^(?:8|11|18)(?!\d)/.test(word) || /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** `ignored` without each word in `drop`, once each, ignoring case. */
function withoutWords(ignored: readonly string[], drop: readonly string[]): readonly string[] {
  const pending = drop.map((word) => word.toLowerCase());
  return ignored.filter((word) => {
    const index = pending.indexOf(word.toLowerCase());
    if (index === -1) return true;
    pending.splice(index, 1);
    return false;
  });
}
