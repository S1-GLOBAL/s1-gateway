import { DomainError } from '../../../shared/domain/domain-error.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { expectedFill } from './applicability.js';
import { fraction, multiply, readDecimal, roundHalfUp, type Fraction } from './measurement.js';
import { buildKeepingWhatFits } from './build-keeping-what-fits.js';
import { readText } from './reading/read-text.js';
import { combinationFor, lidFits } from './tagged-combined-products.js';
import {
  combineAdjacent,
  conflictLine,
  factIn,
  productIncludedWith,
  readIssuedMeanings,
  readNamedMeasures,
  suggestionsFor,
  type FactDraft,
} from './tagged-spec-id-suggestions.js';
import { V2_CAPACITY_DIGIT_BY_UNIT, V2_CAPACITY_UNIT_BY_DIGIT, V2_TAG_DEFINITIONS } from './tagged-spec-id-v2.js';
import { type Dictionary, type DictionaryValue } from './dictionary.js';
import { InvalidSpecIdError } from './spec-id.errors.js';
import {
  SpecId,
  meaningOfFact,
  type DescribedSlot,
  type MeasurementInput,
  type SpecIdFactsInput,
} from './spec-id.js';
import {
  CAPACITY_MAX,
  CAPACITY_UNIT_LABELS,
  COUNTS,
  DICTIONARY_SLOTS,
  DOES_NOT_APPLY,
  NOT_KNOWN,
  RULED_SLOTS,
  SLOTS,
  slotDefinition,
  type CountSlotKey,
  type DictionarySlotKey,
  type MeasureSlotKey,
  type SlotKey,
} from './slots.js';

/**
 * Experimental spelling of a Spec ID: one tag and one number per known fact.
 * Empty slots are left out. A code may be typed in any order; the value stored
 * is always the standard order. Capacity and the measurements are written
 * after a hyphen. The other facts come first.
 *
 * This is not the format Atlas issues. Dictionary numbers follow the order
 * values were issued in S2 0.1.0, and a new value would take the next number.
 */

/** The unit letter stored in a capacity slot, and the tag written for it. `M` (mL) cannot be the tag: material already uses `M`. */
const CAPACITY_TAG_BY_UNIT: Readonly<Record<string, string>> = {
  Z: 'Z',
  M: 'ML',
  S: 'SV',
  N: 'PC',
  G: 'GR',
};

export type TaggedCodeVersion = 'v1' | 'v2';

interface TagDefinition {
  readonly tag: string;
  readonly slot: SlotKey;
  /** Present when this tag is one unit of nominal capacity, not a dictionary list. */
  readonly capacityUnit?: string;
  /** v2 capacity: the first digit chooses the unit and the remaining digits are the amount. */
  readonly capacityByDigit?: boolean;
}

interface TagSet {
  readonly byName: ReadonlyMap<string, TagDefinition>;
  readonly forSlot: ReadonlyMap<SlotKey, string>;
  readonly tags: readonly string[];
}

const TAG_DEFS: readonly TagDefinition[] = [
  { tag: 'PT', slot: 'productType' },
  { tag: 'M', slot: 'material' },
  { tag: 'CT', slot: 'coating' },
  { tag: 'CL', slot: 'colourClarity' },
  { tag: 'SH', slot: 'shape' },
  { tag: 'PF', slot: 'profile' },
  { tag: 'Z', slot: 'capacity', capacityUnit: 'Z' },
  { tag: 'ML', slot: 'capacity', capacityUnit: 'M' },
  { tag: 'SV', slot: 'capacity', capacityUnit: 'S' },
  { tag: 'PC', slot: 'capacity', capacityUnit: 'N' },
  { tag: 'GR', slot: 'capacity', capacityUnit: 'G' },
  { tag: 'TD', slot: 'topDiameter' },
  { tag: 'BD', slot: 'bottomDiameter' },
  { tag: 'H', slot: 'height' },
  { tag: 'LN', slot: 'length' },
  { tag: 'W', slot: 'width' },
  { tag: 'GS', slot: 'gusset' },
  { tag: 'UW', slot: 'unitWeight' },
  { tag: 'BW', slot: 'basisWeight' },
  { tag: 'TH', slot: 'thickness' },
  { tag: 'WL', slot: 'wall' },
  { tag: 'PR', slot: 'print' },
  { tag: 'CM', slot: 'compartments' },
  { tag: 'PL', slot: 'plies' },
  { tag: 'LO', slot: 'lidOpening' },
  { tag: 'HN', slot: 'handle' },
  { tag: 'WR', slot: 'wrap' },
  { tag: 'WN', slot: 'window' },
];

function tagSet(definitions: readonly TagDefinition[]): TagSet {
  return {
    byName: new Map(definitions.map((definition) => [definition.tag, definition])),
    forSlot: new Map(
      definitions.filter((definition) => definition.capacityUnit === undefined).map((definition) => [definition.slot, definition.tag]),
    ),
    tags: definitions.map((definition) => definition.tag),
  };
}

const TAG_SETS: Readonly<Record<TaggedCodeVersion, TagSet>> = {
  v1: tagSet(TAG_DEFS),
  v2: tagSet(V2_TAG_DEFINITIONS),
};

function tagsOf(version: TaggedCodeVersion): TagSet {
  return TAG_SETS[version];
}

/** Every v1 tag, for the rule that no tag is two other tags written together. */
export const TAGGED_SPEC_ID_TAGS: readonly string[] = TAG_SETS.v1.tags;

interface Token {
  readonly def: TagDefinition;
  readonly digits: string;
  readonly tag: string;
}

/** Numbers issued once per dictionary list. Capacity is not a list: its number is the amount, and its tag is the unit. */
export class SlotNumbering {
  private constructor(
    private readonly toNumber: ReadonlyMap<string, number>,
    private readonly toCode: ReadonlyMap<string, string>,
  ) {}

  /** `values` in issuance order. Sorting this list would renumber codes that are already saved. */
  static fromIssuance(values: readonly DictionaryValue[]): SlotNumbering {
    const toNumber = new Map<string, number>();
    const toCode = new Map<string, string>();
    const next = new Map<DictionarySlotKey, number>();
    for (const value of values) {
      if (value.slot === 'capacity') continue;
      const number = (next.get(value.slot) ?? 0) + 1;
      next.set(value.slot, number);
      toNumber.set(`${value.slot}:${value.code}`, number);
      toCode.set(`${value.slot}:${number}`, value.code);
    }
    return new SlotNumbering(toNumber, toCode);
  }

  numberOf(slot: DictionarySlotKey, code: string): number | undefined {
    return this.toNumber.get(`${slot}:${code}`);
  }

  codeOf(slot: DictionarySlotKey, number: number): string | undefined {
    return this.toCode.get(`${slot}:${number}`);
  }
}

export interface TaggedDictionaryEntry {
  /** The new code, such as `PT5` or `Z`. */
  readonly code: string;
  readonly meaning: string;
  /** The letter code this value has in S2, when it had one. */
  readonly former?: string;
}

export interface TaggedDictionaryGroup {
  readonly title: string;
  readonly entries: readonly TaggedDictionaryEntry[];
}

const SIZE_MEANINGS: Readonly<Record<MeasureSlotKey, string>> = {
  topDiameter: 'Top diameter, in millimetres',
  bottomDiameter: 'Bottom diameter, in millimetres',
  height: 'Height, in millimetres',
  length: 'Length, in millimetres',
  width: 'Width, in millimetres',
  gusset: 'Gusset, in millimetres',
  unitWeight: 'Unit weight, in tenths of a gram',
  basisWeight: 'Basis weight, in gsm',
  thickness: 'Thickness, in micrometres',
};

/** The number is the amount. These two are easy to misread, so the row shows one. */
function sizeMeaning(key: MeasureSlotKey, tag: string): string {
  const meaning = SIZE_MEANINGS[key];
  if (key === 'unitWeight') return `${meaning}. 3.3 g is ${tag}33`;
  if (key === 'thickness') return `${meaning}. 350 µm is ${tag}350`;
  return meaning;
}

const MILLIMETRE_SLOTS = ['topDiameter', 'bottomDiameter', 'height', 'length', 'width', 'gusset'] as const;

/** Sizes are stored in millimetres. Centimetres and inches round onto another product's code. */
function millimetreProblems(facts: SpecIdFactsInput): string[] {
  const problems: string[] = [];
  for (const key of MILLIMETRE_SLOTS) {
    const fact = facts[key];
    if (fact == null || fact.unit === 'mm') continue;
    problems.push(`${slotDefinition(key).name} is in millimetres. ${fact.value} ${fact.unit} was not stored.`);
  }
  return problems;
}

/** The S2 dictionary written in the tagged codes. `values` must be in issuance order. */
export function taggedDictionary(
  values: readonly DictionaryValue[],
  numbering: SlotNumbering,
  version: TaggedCodeVersion = 'v1',
): readonly TaggedDictionaryGroup[] {
  const tags = tagsOf(version);
  const groups: TaggedDictionaryGroup[] = [];
  let sizesWritten = false;
  for (const slot of SLOTS) {
    if (slot.kind === 'measure') {
      if (!sizesWritten) {
        groups.push({
          title: 'Sizes',
          entries: SLOTS.filter((item) => item.kind === 'measure').map((item) => {
            const key = item.key as MeasureSlotKey;
            const tag = tags.forSlot.get(key) ?? key;
            return { code: tag, meaning: sizeMeaning(key, tag) };
          }),
        });
        sizesWritten = true;
      }
      continue;
    }
    if (slot.kind === 'count') {
      const tag = tags.forSlot.get(slot.key);
      const count = COUNTS[slot.key as CountSlotKey];
      if (tag && count) {
        groups.push({
          title: slot.name,
          entries: [{ code: tag, meaning: `A count from 1 to ${count.max}. The number is the count` }],
        });
      }
      continue;
    }
    if (slot.key === 'capacity') {
      const capacityTag = tags.forSlot.get('capacity');
      const byDigit = capacityTag !== undefined && tags.byName.get(capacityTag)?.capacityByDigit === true;
      groups.push({
        title: slot.name,
        entries: values
          .filter((value) => value.slot === 'capacity')
          .map((value) => {
            const digit = V2_CAPACITY_DIGIT_BY_UNIT[value.code];
            const label = CAPACITY_UNIT_LABELS[value.code] ?? value.meaning;
            const amount = byDigit && digit !== undefined
              ? `${value.meaning}. The digits after ${digit} are the amount, so 12 ${label} is ${capacityTag}${digit}12`
              : `${value.meaning}. The number is the amount`;
            return {
              code: byDigit && digit !== undefined ? `${capacityTag}${digit}` : (CAPACITY_TAG_BY_UNIT[value.code] ?? value.code),
              meaning: value.code === 'Z' && byDigit && digit !== undefined ? `${amount}. 3.25 ${label} is ${capacityTag}${digit}3.25` : amount,
              former: value.code,
            };
          }),
      });
      continue;
    }
    if (slot.kind !== 'dictionary') continue;
    const tag = tags.forSlot.get(slot.key);
    if (tag === undefined) continue;
    const entries: TaggedDictionaryEntry[] = [];
    for (const value of values) {
      if (value.slot !== slot.key) continue;
      const number = numbering.numberOf(slot.key, value.code);
      if (number === undefined) continue;
      entries.push({ code: `${tag}${number}`, meaning: value.meaning, former: value.code });
    }
    if (entries.length > 0) groups.push({ title: slot.name, entries });
  }
  return groups;
}

export class TaggedSpecIdError extends DomainError {
  override readonly code = 'INVALID_TAGGED_SPEC_ID';

  constructor(readonly problems: readonly string[]) {
    super(problems.join(' '), { problems: [...problems] });
  }
}

/**
 * A Spec ID in the experimental tagged spelling. `code` is the standard order,
 * which is what would be stored and shown.
 */
export class TaggedSpecId {
  private constructor(
    private readonly specId: SpecId,
    private readonly bodyText: string,
    private readonly decimalCapacity?: { readonly spelling: string; readonly meaning: string },
  ) {}

  /**
   * Reads a tagged code, or a code Atlas issues today (dots, `S1.` or `S2.`).
   * Tagged text may be in any order. The result is always the standard order.
   */
  static read(
    input: string,
    dictionary: Dictionary,
    numbering: SlotNumbering,
    version: TaggedCodeVersion = 'v1',
  ): Result<TaggedSpecId, TaggedSpecIdError> {
    const tags = tagsOf(version);
    const trimmed = input.trim();
    if (trimmed.length === 0) return err(new TaggedSpecIdError(['Paste a Spec ID to read it.']));
    if (isIssuedCode(trimmed)) return readCurrent(trimmed, dictionary, numbering, tags);

    const text = trimmed.toUpperCase();
    if (!/^[A-Z0-9.-]+$/.test(text)) {
      return err(new TaggedSpecIdError(['A Spec ID uses letters, numbers and one hyphen.']));
    }
    return interpret(text, dictionary, numbering, tags);
  }

  /** The tagged code for these facts. Slots left out are not written. */
  static build(
    facts: SpecIdFactsInput,
    dictionary: Dictionary,
    numbering: SlotNumbering,
    version: TaggedCodeVersion = 'v1',
  ): Result<TaggedSpecId, TaggedSpecIdError> {
    const units = millimetreProblems(facts);
    if (units.length > 0) return err(new TaggedSpecIdError(units));
    const tags = tagsOf(version);
    const decimal = decimalCapacity(facts, dictionary, tags);
    const built = SpecId.build(decimal === undefined ? facts : { ...facts, capacity: undefined }, dictionary);
    if (!built.ok) return err(new TaggedSpecIdError(problemsOf(built.error)));
    const encoded = encode(built.value, numbering, tags);
    if (typeof encoded !== 'string') return err(new TaggedSpecIdError(encoded));
    if (decimal === undefined) return ok(new TaggedSpecId(built.value, encoded));
    return ok(new TaggedSpecId(built.value, insertCapacity(encoded, decimal.spelling), decimal));
  }

  /** The tagged spelling of a Spec ID that is already valid. */
  static fromSpecId(
    specId: SpecId,
    numbering: SlotNumbering,
    version: TaggedCodeVersion = 'v1',
  ): Result<TaggedSpecId, TaggedSpecIdError> {
    const encoded = encode(specId, numbering, tagsOf(version));
    if (typeof encoded !== 'string') return err(new TaggedSpecIdError(encoded));
    return ok(new TaggedSpecId(specId, encoded));
  }

  /** Standard order. This is the one spelling of the product. */
  get body(): string {
    return this.bodyText;
  }

  /** The same spelling as `body`. */
  get code(): string {
    return this.bodyText;
  }

  /** The known facts, in slot order, in plain words. */
  summary(dictionary: Dictionary): string {
    return this.describe(dictionary)
      .filter((slot) => slot.state === 'value')
      .map((slot) => slot.meaning)
      .join(', ');
  }

  /** The same code with a fractional capacity written after the hyphen. */
  withDecimal(decimal: { readonly spelling: string; readonly meaning: string }): TaggedSpecId {
    return new TaggedSpecId(this.specId, insertCapacity(this.bodyText, decimal.spelling), decimal);
  }

  describe(dictionary: Dictionary): DescribedSlot[] {
    const slots = this.specId.describe(dictionary);
    const decimal = this.decimalCapacity;
    if (decimal === undefined) return slots;
    return slots.map((slot) =>
      slot.key === 'capacity' ? { ...slot, state: 'value', raw: decimal.spelling, meaning: decimal.meaning } : slot,
    );
  }
}

export interface TaggedWatch {
  readonly warnings: readonly string[];
  readonly facts: readonly { readonly name: string; readonly meaning: string }[];
}

/**
 * Reads whatever is in the box so far. A part that does not apply, or a key
 * the dictionary does not have, is warned about and left in the text.
 */
export interface TaggedDescription {
  readonly code: string | null;
  readonly facts: readonly { readonly name: string; readonly meaning: string }[];
  readonly warnings: readonly string[];
  readonly ignored: readonly string[];
}

/**
 * Reads a product description the way Atlas does, keeps only the facts that
 * belong to that product, and writes them as a v2 code. A range is not a fact.
 * A size written in another unit is converted into the unit the slot stores,
 * and the fact says what was converted.
 */
export function describeTagged(
  text: string,
  dictionary: Dictionary,
  numbering: SlotNumbering,
): TaggedDescription {
  const read = readText(text, dictionary);
  const fitted = lidFits(text);
  const fittedCode = fitted !== undefined && dictionary.meaningOf('productType', fitted.code) !== undefined ? fitted.code : undefined;
  const included = fittedCode === undefined ? productIncludedWith(text, read, dictionary, numbering) : undefined;
  const base = fittedCode ?? included?.code ?? (typeof read.facts.productType === 'string' ? read.facts.productType : undefined);
  const paired = fittedCode === undefined ? combinationFor(text, base) : undefined;
  const chosen = paired !== undefined && dictionary.meaningOf('productType', paired) !== undefined ? paired : undefined;
  const productType = chosen ?? fittedCode ?? included?.code;
  const drops = [...(included?.drop ?? []), ...(fittedCode !== undefined ? fitted?.drop ?? [] : [])];
  const reading = productType === undefined ? read : {
    ...read,
    facts: { ...read.facts, productType },
    conflicts: read.conflicts.filter((conflict) => conflict.key !== 'productType'),
    ignored: drops.length === 0 ? read.ignored : dropIgnored(read.ignored, drops),
  };
  const warnings = reading.conflicts.map((conflict) => conflictLine(conflict.key, conflict.found, dictionary, numbering));
  if (included !== undefined && chosen === undefined) warnings.unshift(included.note);
  if (fitted !== undefined && fittedCode !== undefined && chosen === undefined) {
    const meaning = dictionary.meaningOf('productType', fittedCode) ?? fittedCode;
    const number = numbering.numberOf('productType', fittedCode);
    const label = number === undefined ? meaning : `${meaning} (A${number})`;
    warnings.unshift(`The product is the lid. It goes on ${articleBefore(fitted.fits)} ${fitted.fits}. It is ${articleBefore(label)} ${label}.`);
  }
  const combined = combineAdjacent(text, reading, dictionary, numbering);
  warnings.push(...combined.warnings);
  const issued = readIssuedMeanings(text, { ...reading, facts: { ...reading.facts, ...combined.facts }, ignored: combined.ignored }, dictionary);
  const issuedWarnings = fitted === undefined || fittedCode === undefined
    ? issued.warnings
    : issued.warnings.filter((warning) => !warning.startsWith('Product type') || !warning.toLowerCase().includes(fitted.vessel.toLowerCase()));
  warnings.push(...issuedWarnings);
  const named = readNamedMeasures(
    text,
    { ...reading, facts: { ...reading.facts, ...combined.facts, ...issued.facts }, ignored: issued.ignored },
    dictionary,
  );
  warnings.push(...named.warnings);
  const facts: Record<string, unknown> = { ...reading.facts, ...combined.facts, ...issued.facts, ...named.facts };
  const conversions = new Map<string, string>();
  for (const key of Object.keys(CANONICAL_UNIT) as MeasureSlotKey[]) {
    const fact = facts[key];
    if (fact === null || typeof fact !== 'object' || !('unit' in fact) || !('value' in fact)) continue;
    const measurement = fact as MeasurementInput;
    if (measurement.unit === CANONICAL_UNIT[key]) continue;
    const converted = canonicalMeasure(key, measurement.value, measurement.unit);
    const name = slotDefinition(key).name;
    if (converted === undefined) {
      warnings.push(`${name} is in ${storedUnit(key)}. ${measurement.value} ${measurement.unit} was not stored.`);
      delete facts[key];
      continue;
    }
    conversions.set(name, ` (converted from ${measurement.value} ${writtenUnit(measurement.unit)})`);
    facts[key] = converted;
  }

  const decimal = decimalCapacity(facts as unknown as SpecIdFactsInput, dictionary, tagsOf('v2'));
  if (decimal !== undefined) delete facts.capacity;
  const kept = buildKeepingWhatFits(facts as Partial<SpecIdFactsInput>, dictionary);
  for (const dropped of kept.dropped) {
    const name = slotDefinition(dropped.key).name;
    if (warnings.some((warning) => warning.startsWith(`${name} does not apply`))) continue;
    const reason = dropped.reasons[0];
    warnings.push(reason === undefined ? `${name} was left out.` : `${name} was left out. ${reason}`);
  }
  const noted = suggestionsFor({ ...reading, ignored: named.ignored }, kept.facts, dictionary, numbering, text);
  warnings.push(...noted.suggestions);
  if (kept.specId === null) {
    return { code: null, facts: withConversions(looseFacts(kept.facts, dictionary), conversions), warnings, ignored: noted.ignored };
  }
  const tagged = TaggedSpecId.fromSpecId(kept.specId, numbering, 'v2');
  if (!tagged.ok) return { code: null, facts: [], warnings: [...warnings, ...tagged.error.problems], ignored: noted.ignored };
  const shown = decimal === undefined ? tagged.value : tagged.value.withDecimal(decimal);
  return { code: shown.code, facts: withConversions(factsOf(shown, dictionary), conversions), warnings, ignored: noted.ignored };
}

function articleBefore(text: string): 'a' | 'an' {
  const word = text.trim();
  if (/^(?:8|11|18)(?!\d)/.test(word) || /^[aeiou]/i.test(word)) return 'an';
  return 'a';
}

function dropIgnored(ignored: readonly string[], drop: readonly string[]): readonly string[] {
  const pending = drop.map((word) => word.toLowerCase());
  return ignored.filter((word) => {
    const index = pending.indexOf(word.toLowerCase());
    if (index === -1) return true;
    pending.splice(index, 1);
    return false;
  });
}

const CANONICAL_UNIT: Readonly<Record<MeasureSlotKey, string>> = {
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

function storedUnit(key: MeasureSlotKey): string {
  if (key === 'unitWeight') return 'grams';
  if (key === 'basisWeight') return 'gsm';
  if (key === 'thickness') return 'micrometres';
  return 'millimetres';
}

function writtenUnit(unit: string): string {
  if (unit === 'in') return 'inch';
  if (unit === 'um') return 'µm';
  return unit;
}

function canonicalMeasure(slot: MeasureSlotKey, value: string, unit: string): MeasurementInput | undefined {
  const canonical = CANONICAL_UNIT[slot];
  if (unit === canonical) return { value, unit };
  if (canonical === 'mm' && (unit === 'cm' || unit === 'in')) {
    const mm = rounded(value, unit === 'cm' ? fraction(10n, 1n) : fraction(254n, 10n));
    return mm === undefined ? undefined : { value: mm, unit: 'mm' };
  }
  if (canonical === 'um' && (unit === 'mm' || unit === 'cm' || unit === 'in')) {
    const factor = unit === 'mm' ? fraction(1000n, 1n) : unit === 'cm' ? fraction(10000n, 1n) : fraction(25400n, 1n);
    const micrometres = rounded(value, factor);
    return micrometres === undefined ? undefined : { value: micrometres, unit: 'um' };
  }
  if (canonical === 'g' && unit === 'kg') {
    const grams = scaled(value, fraction(1000n, 1n));
    return grams === undefined ? undefined : { value: grams, unit: 'g' };
  }
  return undefined;
}

function rounded(value: string, factor: Fraction): string | undefined {
  const reading = readDecimal(value);
  if (!reading.ok) return undefined;
  return roundHalfUp(multiply(reading.value, factor)).toString();
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

function withConversions(
  facts: TaggedDescription['facts'],
  conversions: ReadonlyMap<string, string>,
): TaggedDescription['facts'] {
  return facts.map((fact) => {
    const note = conversions.get(fact.name);
    return note === undefined ? fact : { name: fact.name, meaning: `${fact.meaning}${note}` };
  });
}

function looseFacts(facts: Partial<SpecIdFactsInput>, dictionary: Dictionary): TaggedDescription['facts'] {
  const listed: { name: string; meaning: string }[] = [];
  for (const slot of SLOTS) {
    const fact = factIn(facts, slot.key);
    if (fact === undefined || fact === null) continue;
    const meaning = meaningOfFact(slot.key, fact, dictionary);
    if (meaning !== undefined) listed.push({ name: slot.name, meaning });
  }
  return listed;
}

export function watchTagged(
  input: string,
  dictionary: Dictionary,
  numbering: SlotNumbering,
  version: TaggedCodeVersion = 'v2',
): TaggedWatch {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { warnings: [], facts: [] };
  const strict = TaggedSpecId.read(trimmed, dictionary, numbering, version);
  if (strict.ok) return { warnings: [], facts: factsOf(strict.value, dictionary) };
  return inspectPartial(trimmed, dictionary, numbering, version);
}

function factsOf(value: TaggedSpecId, dictionary: Dictionary): TaggedWatch['facts'] {
  return value
    .describe(dictionary)
    .filter((slot) => slot.state === 'value')
    .map((slot) => ({ name: slot.name, meaning: slot.meaning }));
}

interface WatchedPiece {
  readonly tag: string | undefined;
  readonly raw: string;
  readonly digits: string;
  readonly open: boolean;
  readonly def: TagDefinition | undefined;
}

function inspectPartial(
  input: string,
  dictionary: Dictionary,
  numbering: SlotNumbering,
  version: TaggedCodeVersion,
): TaggedWatch {
  const tags = tagsOf(version);
  let text = input.trim().toUpperCase();
  const warnings: string[] = [];
  if (!/^[A-Z0-9.-]*$/.test(text.replace(/(\d)\.(\d)/g, '$1$2'))) {
    warnings.push('A Spec ID uses letters, numbers and one hyphen.');
    text = text.replace(/[^A-Z0-9-]/g, '');
  }
  if (text.split('-').length > 2) warnings.push('A Spec ID has one hyphen, before the sizes.');

  const pieces = cutPieces(text.replaceAll('-', ''), tags);
  const seen = new Set<SlotKey>();
  const product = resolvedCode(pieces, 'productType', numbering);
  const shape = resolvedCode(pieces, 'shape', numbering) ?? NOT_KNOWN;
  const material = resolvedCode(pieces, 'material', numbering) ?? NOT_KNOWN;
  const productName = product === undefined ? undefined : dictionary.meaningOf('productType', product)?.toLowerCase();

  const facts: { name: string; meaning: string }[] = [];
  for (const piece of pieces) {
    if (piece.def === undefined) {
      warnings.push(`${piece.raw}: This key/part is unknown.`);
      continue;
    }
    const name = slotDefinition(piece.def.slot).name;
    if (seen.has(piece.def.slot)) {
      warnings.push(`${name} is given twice.`);
      continue;
    }
    seen.add(piece.def.slot);

    const meaning = meaningOfPiece(piece, dictionary, numbering);
    const ruled = (RULED_SLOTS as readonly string[]).includes(piece.def.slot);
    const expected =
      product !== undefined && productName !== undefined && ruled
        ? expectedFill(dictionary, product, piece.def.slot as (typeof RULED_SLOTS)[number], shape, material)
        : undefined;
    if (piece.digits.length === 0) {
      if (!piece.open && expected?.fill !== 'does-not-apply') warnings.push(`${name} (${piece.def.tag}) has no value.`);
    } else if (meaning === undefined && !valueStillComing(piece)) {
      warnings.push(`${piece.def.tag}${piece.digits}: This key/part is unknown.`);
    }

    if (expected?.fill === 'does-not-apply') {
      warnings.push(`${name}: This part is not applicable for a ${productName}.`);
      continue;
    }
    if (meaning !== undefined) facts.push({ name, meaning });
  }
  return { warnings, facts };
}

function resolvedCode(pieces: readonly WatchedPiece[], slot: DictionarySlotKey, numbering: SlotNumbering): string | undefined {
  const piece = pieces.find((candidate) => candidate.def?.slot === slot && candidate.digits.length > 0);
  if (piece?.def === undefined) return undefined;
  const number = positiveInteger(piece.digits);
  if (number === undefined) return undefined;
  return numbering.codeOf(slot, number);
}

function meaningOfPiece(piece: WatchedPiece, dictionary: Dictionary, numbering: SlotNumbering): string | undefined {
  const def = piece.def;
  if (def === undefined || piece.digits.length === 0) return undefined;
  if (def.capacityByDigit || def.capacityUnit !== undefined) {
    const unit = def.capacityByDigit ? V2_CAPACITY_UNIT_BY_DIGIT[piece.digits.slice(0, 1)] : def.capacityUnit;
    const rawAmount = def.capacityByDigit ? piece.digits.slice(1) : piece.digits;
    const amount = capacityAmount(rawAmount);
    if (unit === undefined || amount === undefined) return undefined;
    const label = CAPACITY_UNIT_LABELS[unit];
    return label === undefined ? undefined : `${amount} ${label}`;
  }
  if (isListedSlot(def.slot)) {
    const number = positiveInteger(piece.digits);
    if (number === undefined) return undefined;
    const code = numbering.codeOf(def.slot, number);
    if (code === undefined) return undefined;
    return meaningOfFact(def.slot, code, dictionary);
  }
  const steps = positiveInteger(piece.digits);
  if (steps === undefined) return undefined;
  if (isMeasureSlot(def.slot)) return meaningOfFact(def.slot, measurement(def.slot, steps), dictionary);
  if (isCountSlot(def.slot)) return meaningOfFact(def.slot, String(steps), dictionary);
  return undefined;
}

function cutPieces(text: string, tags: TagSet): WatchedPiece[] {
  const pieces: WatchedPiece[] = [];
  let index = 0;
  while (index < text.length) {
    if (isDigit(text.charAt(index))) {
      let end = index;
      while (end < text.length && isDigit(text.charAt(end))) end += 1;
      pieces.push({ tag: undefined, raw: text.slice(index, end), digits: '', open: false, def: undefined });
      index = end;
      continue;
    }
    let letterEnd = index;
    while (letterEnd < text.length && isLetter(text.charAt(letterEnd))) letterEnd += 1;
    let digitEnd = valueEnd(text, letterEnd, text.slice(index, letterEnd), tags);
    const cut = cutTags(text.slice(index, letterEnd), tags);
    const digits = text.slice(letterEnd, digitEnd);
    const trailing = digitEnd === text.length;
    for (let pieceIndex = 0; pieceIndex < cut.length; pieceIndex += 1) {
      const piece = cut[pieceIndex];
      if (piece === undefined) continue;
      const last = pieceIndex === cut.length - 1;
      pieces.push({
        tag: piece.tag,
        raw: piece.raw,
        digits: last ? digits : '',
        open: last && trailing && digits.length === 0,
        def: piece.tag === undefined ? undefined : tags.byName.get(piece.tag),
      });
    }
    index = digitEnd;
  }
  return pieces;
}

/** A trailing zero, or a capacity whose amount is still a zero, is not a value yet. */
function valueStillComing(piece: WatchedPiece): boolean {
  if (!piece.open) return false;
  if (piece.def?.capacityByDigit === true) return /^[1-5]0*$/.test(piece.digits);
  return /^0+$/.test(piece.digits);
}

function cutTags(letters: string, tags: TagSet): { tag?: string; raw: string }[] {
  if (tags.byName.has(letters)) return [{ tag: letters, raw: letters }];
  const ways = partitions(letters, tags);
  if (ways.length === 1) return (ways[0] ?? []).map((tag) => ({ tag, raw: tag }));
  if (ways.length > 1) return [{ raw: letters }];
  const pieces: { tag?: string; raw: string }[] = [];
  let rest = letters;
  while (rest.length > 0) {
    const matched = [...tags.tags].filter((tag) => rest.startsWith(tag)).sort((left, right) => right.length - left.length)[0];
    if (matched !== undefined) {
      pieces.push({ tag: matched, raw: matched });
      rest = rest.slice(matched.length);
      continue;
    }
    pieces.push({ raw: rest.charAt(0) });
    rest = rest.slice(1);
  }
  return pieces;
}

function readCurrent(
  code: string,
  dictionary: Dictionary,
  numbering: SlotNumbering,
  tags: TagSet,
): Result<TaggedSpecId, TaggedSpecIdError> {
  const parsed = SpecId.parse(code, dictionary);
  if (!parsed.ok) return err(new TaggedSpecIdError(problemsOf(parsed.error)));
  return TaggedSpecId.fromSpecId(parsed.value, numbering, tags === TAG_SETS.v2 ? 'v2' : 'v1');
}

function interpret(
  text: string,
  dictionary: Dictionary,
  numbering: SlotNumbering,
  tags: TagSet,
): Result<TaggedSpecId, TaggedSpecIdError> {
  if (text.length === 0) return err(new TaggedSpecIdError(['Paste a Spec ID to read it.']));
  if (text.split('-').length > 2) {
    return err(new TaggedSpecIdError(['A Spec ID has one hyphen, before the sizes.']));
  }
  const scanned = scan(text.replaceAll('-', ''), tags);
  if (scanned.problems.length > 0) return err(new TaggedSpecIdError(scanned.problems));

  const problems = duplicateProblems(scanned.tokens);
  const productTag = tags.forSlot.get('productType') ?? 'PT';
  if (!scanned.tokens.some((token) => token.def.slot === 'productType')) {
    problems.push(`Product type (${productTag}) is missing. Every code includes it, for example ${productTag}1.`);
  }
  if (problems.length > 0) return err(new TaggedSpecIdError(problems));

  const facts: FactDraft = {};
  for (const token of scanned.tokens) {
    const name = slotDefinition(token.def.slot).name;
    if (token.def.capacityByDigit) {
      const unit = V2_CAPACITY_UNIT_BY_DIGIT[token.digits.slice(0, 1)];
      const amount = capacityAmount(token.digits.slice(1));
      if (unit === undefined || amount === undefined) {
        problems.push(`${name}: write a unit digit then the amount, for example ${token.def.tag}112 for 12 oz.`);
      } else {
        facts.capacity = { unit, value: amount };
      }
      continue;
    }
    if (token.def.capacityUnit !== undefined) {
      const amount = capacityAmount(token.digits);
      if (amount === undefined) problems.push(`${name}: ${token.digits} is not a value.`);
      else facts.capacity = { unit: token.def.capacityUnit, value: amount };
      continue;
    }
    const value = positiveInteger(token.digits);
    if (value === undefined) {
      problems.push(`${name}: ${token.digits} is not a value.`);
      continue;
    }
    if (isListedSlot(token.def.slot)) {
      const code = numbering.codeOf(token.def.slot, value);
      if (code === undefined) problems.push(`${name}: ${value} is not in the dictionary.`);
      else assignCode(facts, token.def.slot, code);
      continue;
    }
    if (isMeasureSlot(token.def.slot)) {
      assignMeasure(facts, token.def.slot, value);
      continue;
    }
    if (isCountSlot(token.def.slot)) assignCount(facts, token.def.slot, value);
  }
  if (problems.length > 0 || facts.productType === undefined) return err(new TaggedSpecIdError(problems));

  const productType = facts.productType;
  const product = (dictionary.meaningOf('productType', productType) ?? productType).toLowerCase();
  const shape = facts.shape ?? NOT_KNOWN;
  const material = facts.material ?? NOT_KNOWN;
  const given = new Set(scanned.tokens.map((token) => token.def.slot));
  for (const key of RULED_SLOTS) {
    if (!given.has(key)) continue;
    const expected = expectedFill(dictionary, productType, key, shape, material);
    if (!expected || expected.fill === 'any') continue;
    const name = slotDefinition(key).name;
    problems.push(
      expected.fill === 'does-not-apply'
        ? `${name} doesn't apply to a ${product}. Leave it out.`
        : `${name} can't be set while the ${expected.dependsOn} is not known. Add the ${expected.dependsOn}, or leave ${name.toLowerCase()} out.`,
    );
  }
  if (problems.length > 0) return err(new TaggedSpecIdError(problems));

  return TaggedSpecId.build({ ...facts, productType }, dictionary, numbering, tags === TAG_SETS.v2 ? 'v2' : 'v1');
}

function scan(text: string, tags: TagSet): { problems: string[]; tokens: Token[] } {
  const problems: string[] = [];
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const start = text.charAt(index);
    if (!isLetter(start)) {
      return {
        problems: [`A code is tags and numbers, like ${exampleCode(tags)}. This one has a number before its tag.`],
        tokens: [],
      };
    }
    let letterEnd = index;
    while (letterEnd < text.length && isLetter(text.charAt(letterEnd))) letterEnd += 1;
    let digitEnd = valueEnd(text, letterEnd, text.slice(index, letterEnd), tags);
    const absorbed = absorb(text.slice(index, letterEnd), text.slice(letterEnd, digitEnd), tags);
    problems.push(...absorbed.problems);
    tokens.push(...absorbed.tokens);
    index = digitEnd;
  }
  return { problems, tokens };
}

function absorb(letters: string, digits: string, tags: TagSet): { problems: string[]; tokens: Token[] } {
  const known = tags.byName.get(letters);
  if (known) {
    if (digits.length === 0) return { problems: [missingValue(known)], tokens: [] };
    return { problems: [], tokens: [{ def: known, digits, tag: letters }] };
  }
  const split = splitUnknown(letters, tags);
  if (split === undefined) return { problems: [`${letters} is not a tag.`], tokens: [] };
  if (split === 'ambiguous') {
    return { problems: [`${letters} could be more than one set of tags, so it was not read.`], tokens: [] };
  }
  const problems: string[] = [];
  const tokens: Token[] = [];
  for (let index = 0; index < split.length; index += 1) {
    const tag = split[index];
    const def = tag === undefined ? undefined : tags.byName.get(tag);
    if (def === undefined) continue;
    const last = index === split.length - 1;
    if (!last || digits.length === 0) problems.push(missingValue(def));
    else tokens.push({ def, digits, tag: def.tag });
  }
  return { problems, tokens };
}

/** Ways to break `word` into tags. A single known tag is not a split: the caller already handled it. */
function splitUnknown(word: string, tags: TagSet): readonly string[] | 'ambiguous' | undefined {
  const ways = partitions(word, tags).filter((way) => way.length > 1);
  if (ways.length > 1) return 'ambiguous';
  return ways[0];
}

function partitions(word: string, tags: TagSet): string[][] {
  const memo = new Map<string, string[][]>();
  const walk = (rest: string): string[][] => {
    if (rest.length === 0) return [[]];
    const cached = memo.get(rest);
    if (cached) return cached;
    const ways: string[][] = [];
    for (const tag of tags.tags) {
      if (!rest.startsWith(tag)) continue;
      for (const tail of walk(rest.slice(tag.length))) ways.push([tag, ...tail]);
    }
    memo.set(rest, ways);
    return ways;
  };
  return walk(word);
}

function duplicateProblems(tokens: readonly Token[]): string[] {
  const seen = new Set<SlotKey>();
  const problems: string[] = [];
  for (const token of tokens) {
    if (seen.has(token.def.slot)) problems.push(`${slotDefinition(token.def.slot).name} is given twice.`);
    else seen.add(token.def.slot);
  }
  return problems;
}

function missingValue(definition: TagDefinition): string {
  const name = slotDefinition(definition.slot).name;
  return `${name} (${definition.tag}) has no value. Write a number after ${definition.tag}, for example ${definition.tag}1.`;
}

/** Capacity and every measurement. Written after the hyphen, in slot order. */
const SIZE_SLOTS: ReadonlySet<SlotKey> = new Set([
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
]);

function exampleCode(tags: TagSet): string {
  const product = tags.forSlot.get('productType') ?? 'PT';
  const material = tags.forSlot.get('material') ?? 'M';
  return `${product}5${material}17`;
}

function encode(specId: SpecId, numbering: SlotNumbering, tags: TagSet): string | string[] {
  const problems: string[] = [];
  const facts: string[] = [];
  const sizes: string[] = [];
  for (const slot of SLOTS) {
    const raw = specId.slot(slot.key);
    if (raw === NOT_KNOWN || raw === DOES_NOT_APPLY) continue;
    const part = encodeRaw(slot.key, raw, numbering, tags);
    if (typeof part !== 'string') problems.push(...part);
    else if (SIZE_SLOTS.has(slot.key)) sizes.push(part);
    else facts.push(part);
  }
  if (problems.length > 0) return problems;
  if (sizes.length === 0) return facts.join('');
  return `${facts.join('')}-${sizes.join('')}`;
}

function encodeRaw(key: SlotKey, raw: string, numbering: SlotNumbering, tags: TagSet): string | string[] {
  const slot = slotDefinition(key);
  switch (slot.kind) {
    case 'variant':
      return [`${slot.name} is not written in this code.`];
    case 'capacity': {
      const unit = raw.slice(0, 1);
      const amount = unpadded(raw.slice(1));
      const single = tags.forSlot.get('capacity');
      const byDigit = single !== undefined && tags.byName.get(single)?.capacityByDigit === true;
      if (byDigit) {
        const digit = V2_CAPACITY_DIGIT_BY_UNIT[unit];
        if (digit === undefined || single === undefined) return [`${slot.name}: ${unit} has no tag.`];
        return `${single}${digit}${amount}`;
      }
      const tag = CAPACITY_TAG_BY_UNIT[unit];
      if (tag === undefined) return [`${slot.name}: ${unit} has no tag.`];
      return tag + amount;
    }
    case 'measure':
    case 'count': {
      const tag = tags.forSlot.get(key);
      if (tag === undefined) return [`${slot.name} has no tag.`];
      return tag + unpadded(raw);
    }
    case 'dictionary': {
      const tag = tags.forSlot.get(key);
      const number = numbering.numberOf(key as DictionarySlotKey, raw);
      if (tag === undefined) return [`${slot.name} has no tag.`];
      if (number === undefined) return [`${slot.name}: ${raw} has no number.`];
      return `${tag}${number}`;
    }
  }
}

type ListedSlot = Exclude<DictionarySlotKey, 'capacity'>;

function isListedSlot(key: SlotKey): key is ListedSlot {
  return key !== 'capacity' && (DICTIONARY_SLOTS as readonly string[]).includes(key);
}

function isMeasureSlot(key: SlotKey): key is MeasureSlotKey {
  return (
    key === 'topDiameter' ||
    key === 'bottomDiameter' ||
    key === 'height' ||
    key === 'length' ||
    key === 'width' ||
    key === 'gusset' ||
    key === 'unitWeight' ||
    key === 'basisWeight' ||
    key === 'thickness'
  );
}

function isCountSlot(key: SlotKey): key is CountSlotKey {
  return key === 'compartments' || key === 'plies';
}

function assignCode(facts: FactDraft, slot: ListedSlot, code: string): void {
  switch (slot) {
    case 'productType':
      facts.productType = code;
      break;
    case 'material':
      facts.material = code;
      break;
    case 'coating':
      facts.coating = code;
      break;
    case 'colourClarity':
      facts.colourClarity = code;
      break;
    case 'shape':
      facts.shape = code;
      break;
    case 'profile':
      facts.profile = code;
      break;
    case 'wall':
      facts.wall = code;
      break;
    case 'print':
      facts.print = code;
      break;
    case 'lidOpening':
      facts.lidOpening = code;
      break;
    case 'handle':
      facts.handle = code;
      break;
    case 'wrap':
      facts.wrap = code;
      break;
    case 'window':
      facts.window = code;
      break;
  }
}

function assignMeasure(facts: FactDraft, slot: MeasureSlotKey, steps: number): void {
  const fact = measurement(slot, steps);
  switch (slot) {
    case 'topDiameter':
      facts.topDiameter = fact;
      break;
    case 'bottomDiameter':
      facts.bottomDiameter = fact;
      break;
    case 'height':
      facts.height = fact;
      break;
    case 'length':
      facts.length = fact;
      break;
    case 'width':
      facts.width = fact;
      break;
    case 'gusset':
      facts.gusset = fact;
      break;
    case 'unitWeight':
      facts.unitWeight = fact;
      break;
    case 'basisWeight':
      facts.basisWeight = fact;
      break;
    case 'thickness':
      facts.thickness = fact;
      break;
  }
}

function measurement(slot: MeasureSlotKey, steps: number): MeasurementInput {
  if (slot === 'unitWeight') {
    const whole = Math.trunc(steps / 10);
    const tenths = steps % 10;
    return { value: tenths === 0 ? String(whole) : `${whole}.${tenths}`, unit: 'g' };
  }
  if (slot === 'basisWeight') return { value: String(steps), unit: 'gsm' };
  if (slot === 'thickness') return { value: String(steps), unit: 'um' };
  return { value: String(steps), unit: 'mm' };
}

function assignCount(facts: FactDraft, slot: CountSlotKey, value: number): void {
  if (slot === 'compartments') facts.compartments = String(value);
  else facts.plies = String(value);
}

function isIssuedCode(text: string): boolean {
  if (!text.includes('.')) return false;
  if (/^S[12]\./i.test(text)) return true;
  return /[^0-9]\.|\.[^0-9]/.test(text);
}

function valueEnd(text: string, letterEnd: number, letters: string, tags: TagSet): number {
  let end = letterEnd;
  while (end < text.length && isDigit(text.charAt(end))) end += 1;
  const def = tags.byName.get(letters);
  const capacity = def?.capacityByDigit === true || def?.capacityUnit !== undefined;
  if (capacity && text.charAt(end) === '.' && isDigit(text.charAt(end + 1))) {
    end += 1;
    while (end < text.length && isDigit(text.charAt(end))) end += 1;
  }
  return end;
}

/** A positive capacity amount. A fraction keeps its point. `6.0` is `6`. */
function capacityAmount(raw: string): string | undefined {
  const reading = readDecimal(raw);
  if (!reading.ok) return undefined;
  const { numerator, denominator } = reading.value;
  if (numerator <= 0n || numerator > CAPACITY_MAX * denominator) return undefined;
  if (numerator % denominator === 0n) {
    const whole = numerator / denominator;
    return whole < 1n ? undefined : whole.toString();
  }
  const whole = numerator / denominator;
  const scale = denominator.toString().length - 1;
  const digits = (numerator % denominator).toString().padStart(scale, '0').replace(/0+$/, '');
  return `${whole}.${digits}`;
}

function decimalCapacity(
  facts: SpecIdFactsInput,
  dictionary: Dictionary,
  tags: TagSet,
): { readonly spelling: string; readonly meaning: string } | undefined {
  const capacity = facts.capacity;
  if (capacity == null || facts.productType === undefined) return undefined;
  const amount = capacityAmount(capacity.value);
  if (amount === undefined || !amount.includes('.')) return undefined;
  const expected = expectedFill(
    dictionary,
    facts.productType,
    'capacity',
    facts.shape ?? undefined,
    facts.material ?? undefined,
  );
  if (expected !== null && expected.fill !== 'any') return undefined;
  const label = CAPACITY_UNIT_LABELS[capacity.unit];
  const spelling = capacitySpelling(capacity.unit, amount, tags);
  if (label === undefined || spelling === undefined) return undefined;
  return { spelling, meaning: `${amount} ${label}` };
}

function capacitySpelling(unit: string, amount: string, tags: TagSet): string | undefined {
  const single = tags.forSlot.get('capacity');
  const byDigit = single !== undefined && tags.byName.get(single)?.capacityByDigit === true;
  if (byDigit) {
    const digit = V2_CAPACITY_DIGIT_BY_UNIT[unit];
    if (digit === undefined || single === undefined) return undefined;
    return `${single}${digit}${amount}`;
  }
  const tag = CAPACITY_TAG_BY_UNIT[unit];
  return tag === undefined ? undefined : tag + amount;
}

function insertCapacity(code: string, spelling: string): string {
  const hyphen = code.indexOf('-');
  if (hyphen === -1) return `${code}-${spelling}`;
  return `${code.slice(0, hyphen + 1)}${spelling}${code.slice(hyphen + 1)}`;
}

function positiveInteger(digits: string): number | undefined {
  if (!/^[0-9]+$/.test(digits)) return undefined;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value < 1) return undefined;
  return value;
}

function unpadded(digits: string): string {
  const stripped = digits.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

function problemsOf(error: InvalidSpecIdError): string[] {
  const problems: string[] = [];
  for (const messages of Object.values(error.issues)) {
    if (messages) problems.push(...messages);
  }
  return problems;
}

function isLetter(char: string): boolean {
  return char >= 'A' && char <= 'Z';
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}
