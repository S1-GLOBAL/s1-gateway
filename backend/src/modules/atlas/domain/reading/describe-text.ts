import { buildKeepingWhatFits } from '../build-keeping-what-fits.js';
import type { Dictionary } from '../dictionary.js';
import { fraction, multiply, readDecimal, roundHalfUp, type Fraction } from '../measurement.js';
import { ROUND_SHAPE, SLOTS, slotDefinition, type MeasureSlotKey, type SlotKey } from '../slots.js';
import type { MeasurementInput, SpecIdFactsInput } from '../spec-id-facts.js';
import { meaningOfFact, type SpecId } from '../spec-id.js';
import { combinationFor, joinerWords, lidFits } from './combined-products.js';
import {
  combineAdjacent,
  conflictLine,
  namedMeasureSpans,
  productIncludedWith,
  readIssuedMeanings,
  readNamedMeasures,
  suggestionsFor,
} from './notes.js';
import { readText, type TextReading } from './read-text.js';
import { shapeOfLengthAndWidth } from './size-rulings.js';

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
  /** Of `notes`, those that say how the product type was settled: a lid's fit, what comes with it. */
  readonly productNotes: readonly string[];
  /** Every fact read, each size in the unit its slot stores, before those its product cannot have were left out. */
  readonly drafted: Partial<SpecIdFactsInput>;
  /** The words nothing used, nor any note explains. */
  readonly ignored: readonly string[];
}

/**
 * Reads a product description the way Atlas reads text (ADR 0026), then
 * passes the plan 0011 reader adds: a lid named by what it fits, a vessel
 * sold with its lid, two values for one fact, words that together name one
 * option, a size written beside its name. A range is not a fact. A size in
 * another unit is converted into the unit its slot stores, and says so. A
 * `productType` or `material` given is final: no pass changes it.
 */
export function describeText(text: string, dictionary: Dictionary, productType?: string, material?: string): TextDescription {
  const read = readText(text, dictionary, productType, material);
  const open = productType === undefined;
  const fitted = open ? lidFits(text) : undefined;
  const fittedCode =
    fitted !== undefined && dictionary.meaningOf('productType', fitted.code) !== undefined ? fitted.code : undefined;
  const included = open && fittedCode === undefined ? productIncludedWith(text, read, dictionary) : undefined;
  const base = fittedCode ?? included?.code ?? (typeof read.facts.productType === 'string' ? read.facts.productType : undefined);
  const paired = open && fittedCode === undefined ? combinationFor(text, base) : undefined;
  const chosen = paired !== undefined && dictionary.meaningOf('productType', paired) !== undefined ? paired : undefined;
  const settled = chosen ?? fittedCode ?? included?.code;
  const drops = [
    ...(included?.drop ?? []),
    ...(fittedCode !== undefined ? (fitted?.drop ?? []) : []),
    ...(included === undefined ? joinerWords(text, settled ?? read.facts.productType) : []),
  ];
  const ignored = drops.length === 0 ? read.ignored : withoutWords(read.ignored, drops);
  const reading: TextReading = withNamedSizes(
    text,
    dictionary,
    settled === undefined
      ? { ...read, ignored }
      : {
          ...read,
          facts: { ...read.facts, productType: settled },
          conflicts: read.conflicts.filter((conflict) => conflict.key !== 'productType'),
          ignored,
        },
  );

  const productNotes: string[] = [];
  if (fitted !== undefined && fittedCode !== undefined && chosen === undefined) {
    const label = productLabel(fittedCode, dictionary);
    productNotes.push(`The product is the lid. It goes on ${articleBefore(fitted.fits)} ${fitted.fits}. It is ${articleBefore(label)} ${label}.`);
  }
  if (included !== undefined && chosen === undefined) productNotes.push(included.note);
  if (read.addOn !== undefined) {
    productNotes.push(`${productLabel(read.addOn, dictionary)} comes with the product, but the product itself is not named.`);
  }
  if (read.productTypeFrom !== undefined && settled === undefined && typeof read.facts.productType === 'string') {
    const label = productLabel(read.facts.productType, dictionary);
    productNotes.push(`Only ${label} has a ${slotDefinition(read.productTypeFrom).name.toLowerCase()}, so that is the product.`);
  }
  const notes = [...productNotes, ...reading.conflicts.map((conflict) => conflictLine(conflict.key, conflict.found, dictionary))];

  // A product type or material given is final: no pass's note about it has anything left to settle.
  const settledSlots = [productType === undefined ? undefined : 'Product type', material === undefined ? undefined : 'Material'].filter(
    (name): name is string => name !== undefined,
  );
  const unsettled = (note: string) => !settledSlots.some((name) => note.startsWith(`${name}:`) || note.startsWith(`${name} was given as`));
  const combined = combineAdjacent(text, reading, dictionary);
  notes.push(...combined.warnings.filter(unsettled));
  const issued = readIssuedMeanings(
    text,
    { ...reading, facts: { ...reading.facts, ...combined.facts }, ignored: combined.ignored },
    dictionary,
  );
  notes.push(
    ...(fitted === undefined || fittedCode === undefined
      ? issued.warnings.filter(unsettled)
      : issued.warnings.filter(
          (note) => unsettled(note) && (!note.startsWith('Product type') || !note.toLowerCase().includes(fitted.vessel.toLowerCase())),
        )),
  );
  const named = readNamedMeasures(
    text,
    { ...reading, facts: { ...reading.facts, ...combined.facts, ...issued.facts }, ignored: issued.ignored },
    dictionary,
  );
  notes.push(...named.warnings.filter(unsettled));

  const facts: Record<string, unknown> = {
    ...reading.facts,
    ...combined.facts,
    ...issued.facts,
    ...named.facts,
    // A product type or material given stays as given, whatever a pass read.
    ...(productType === undefined ? {} : { productType }),
    ...(material === undefined ? {} : { material }),
  };
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
  for (const bare of capacityOpen ? suggested.ignored.filter((word) => /^\d{2,4}$/.test(word) && standsAlone(text, word)) : []) {
    notes.push(`${bare} has no unit. If it is the capacity, write ${bare} ml or ${bare} oz.`);
  }
  return {
    specId: kept.specId,
    facts: kept.facts,
    reading,
    conversions,
    notes,
    productNotes,
    drafted: facts as Partial<SpecIdFactsInput>,
    ignored: suggested.ignored,
  };
}

/**
 * The reading ready for the sizes the text names. A size a ruling read from a
 * number the text names as another size is left out: in "Top diameter 180 x
 * Bottom diameter 150 X Height 70 mm", "70 mm" is the height, no rim, and the
 * named measures give each size that ruling read. A diameter the text names
 * makes the product round, as a ruling's rim does; a tray's or a clamshell's
 * length and width make it rectangular, as R6 does.
 */
function withNamedSizes(text: string, dictionary: Dictionary, given: TextReading): TextReading {
  const lower = text.toLowerCase();
  const named = namedMeasureSpans(text);
  const round = dictionary.live('shape', ROUND_SHAPE);
  const diameter = named.some((span) => span.slot === 'topDiameter' || span.slot === 'bottomDiameter');
  // "L115 x W120 x H72" on a clamshell: R6 would name it rectangular, so the named sizes do.
  const sides = named.some((span) => span.slot === 'length') && named.some((span) => span.slot === 'width');
  const type = typeof given.facts.productType === 'string' ? given.facts.productType : undefined;
  const boxed = sides && type !== undefined ? shapeOfLengthAndWidth(type, dictionary) : undefined;
  const shape = given.facts.shape === undefined ? (diameter ? round : boxed) : undefined;
  const reading: TextReading = shape === undefined ? given : { ...given, facts: { ...given.facts, shape } };
  // A ruling is wrong when the text names one of its numbers as a size it did not read it as:
  // another slot, or the same slot with another number ("200 x 150 x 40 (W x L x H)").
  const ruled = reading.read.filter((fact) => fact.ruling !== null);
  const ruledFacts = reading.facts as Record<string, unknown>;
  const claimed = new Set(
    ruled
      .filter((fact) => {
        const start = lower.indexOf(fact.words.toLowerCase());
        const end = start + fact.words.length;
        const read = new Set(ruled.filter((other) => other.ruling === fact.ruling).map((other) => other.key));
        return (
          start !== -1 &&
          named.some(
            (span) =>
              span.start < end && start < span.end && (!read.has(span.slot) || !sameSize(ruledFacts[span.slot], span.value, span.unit)),
          )
        );
      })
      .map((fact) => fact.ruling),
  );
  if (claimed.size === 0) return reading;
  // The ruling's shape stays: a rim or a diameter, named or not, is on a round product.
  const dropped = new Set(
    reading.read.filter((fact) => fact.ruling !== null && claimed.has(fact.ruling) && fact.key !== 'shape').map((fact) => fact.key),
  );
  const facts: Record<string, unknown> = { ...reading.facts };
  for (const key of dropped) delete facts[key];
  // The shape it named stays, but no longer from that ruling's words.
  const read = reading.read
    .filter((fact) => !dropped.has(fact.key))
    .map((fact) => (fact.ruling !== null && claimed.has(fact.ruling) ? { ...fact, ruling: null, words: '' } : fact));
  return { ...reading, facts: facts as Partial<SpecIdFactsInput>, read };
}

/**
 * Whether `number` is written somewhere with nothing that makes it a size or
 * a count beside it: no "x", unit, inch mark, "+", "/" or decimal point.
 * "500" in "Printed 500 paper bowl" stands alone; "355" in "355 x 355 mm" does not.
 */
function standsAlone(text: string, number: string): boolean {
  const alone = new RegExp(`(?<![\\d.,/+'"x×*-]\\s*)(?<![\\d.])${number}(?![\\d.])(?!\\s*(?:[x×*/+'"%-]|mm|cm|in|g|gsm|kg|ml|oz|ft|m)(?![a-z]))`, 'i');
  return alone.test(text);
}

/** Millimetres in each length unit a size is read in. */
const MM_IN: Readonly<Record<string, number>> = { mm: 1, cm: 10, in: 25.4 };

/** Whether a size a ruling read is the one a name gives, to the millimetre. */
function sameSize(read: unknown, value: string, unit: string | undefined): boolean {
  if (read === null || typeof read !== 'object' || !('value' in read) || !('unit' in read)) return true;
  const ruled = read as MeasurementInput;
  const [a, b] = [MM_IN[ruled.unit], MM_IN[unit ?? 'mm']];
  if (a === undefined || b === undefined) return ruled.value === value && ruled.unit === (unit ?? 'mm');
  return Math.abs(Number(ruled.value) * a - Number(value) * b) < 1;
}

/** A product type as a note names it: `Bag (A16)`. */
function productLabel(code: string, dictionary: Dictionary): string {
  const meaning = dictionary.meaningOf('productType', code) ?? code;
  const number = dictionary.numberOf('productType', code);
  return number === undefined ? meaning : `${meaning} (A${number})`;
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
