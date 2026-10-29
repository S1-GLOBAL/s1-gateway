import { err, ok, type Result } from '../../../shared/domain/result.js';
import { expectedFill, isDoesNotApply, isNotKnown } from './applicability.js';
import { capacityValue, isDottedCode, partOf, readCodeFacts, writeCode, writtenSlots } from './code.js';
import type { Dictionary } from './dictionary.js';
import { MAX_DECIMAL_PLACES, multiply, readDecimal, roundHalfUp } from './measurement.js';
import { S1_ADDED_SLOTS, S1_LENGTH, S1_PARTS, shortForm } from './old-codes.js';
import type { CapacityInput, MeasurementInput, SpecIdFactsInput } from './spec-id-facts.js';
import { InvalidSpecIdError, type SpecIdIssues } from './spec-id.errors.js';
import { specIdMessages as messages } from './spec-id.messages.js';
import {
  CAPACITY_MAX,
  CAPACITY_UNIT_LABELS,
  COUNTS,
  DICTIONARY_SLOTS,
  DOES_NOT_APPLY,
  MEASURES,
  NO_VARIANT,
  NOT_KNOWN,
  RULED_SLOTS,
  SLOT_COUNT,
  slotDefinition,
  SLOTS,
  UNIT_LABELS,
  type CountSlotKey,
  type DictionarySlotKey,
  type MeasureSlotKey,
  type RuledSlotKey,
  type SlotDefinition,
  type SlotKey,
} from './slots.js';

export type { CapacityInput, MeasurementInput, SpecIdFactsInput } from './spec-id-facts.js';

export type SlotState = 'value' | 'not-known' | 'does-not-apply';

/** One slot of a Spec ID, read in plain words. */
export interface DescribedSlot {
  readonly number: number;
  readonly key: SlotKey;
  readonly name: string;
  /** The slot's value as it is stored: `BCS`, `Z0012`, `0090`, or the marker `Y` or `X` (ADR 0025). */
  readonly raw: string;
  /** How the code writes it: `B17`, `G112`, `H90`; empty when it is left out (ADR 0032). */
  readonly part: string;
  readonly state: SlotState;
  /** "Bowl lid", "90 mm", "3.3 g", "Not known", "Doesn't apply". */
  readonly meaning: string;
}

type SlotValues = Readonly<Record<SlotKey, string>>;

const DIGITS = /^\d+$/;
/** A capacity's amount as its slot holds it: four digits, then perhaps a point and up to six more. */
const CAPACITY_DIGITS = new RegExp(`^\\d{4}(?:\\.\\d{1,${MAX_DECIMAL_PLACES}})?$`);

/** The dictionary slots that hold a code as they are, without a number after it. */
const CODE_SLOTS = [
  'material',
  'coating',
  'colourClarity',
  'shape',
  'profile',
  'wall',
  'print',
  'lidOpening',
  'handle',
  'wrap',
  'window',
] as const;

const COUNT_SLOTS: readonly CountSlotKey[] = ['compartments', 'plies'];

const MEASURE_SLOTS: readonly MeasureSlotKey[] = [
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

/** A fact read into its slot: the raw text, or the one message saying why not. */
type Reading = { readonly raw: string; readonly problem?: undefined } | { readonly problem: string };

/**
 * A Spec ID (ADR 0019, ADR 0024, ADR 0025, ADR 0032): 25 slots, product type
 * first, saying what a product physically is. A slot not known holds `Y`, one
 * that doesn't apply `X`. Its code writes each known slot as a letter and a
 * number, `A5B17D3E1Q2R3-G112H90J110`, leaving the others out. Every instance
 * is valid against the dictionary it was read or built with.
 */
export class SpecId {
  private constructor(
    private readonly values: SlotValues,
    private readonly writtenCode: string,
  ) {}

  /**
   * Reads a code. One written today may have its letters in any order and
   * either case; its messages are about the whole code. A dotted code given
   * out before is read slot by slot, with at most one message per slot: S1,
   * long (`S2.`) or short, a marker written wide (`0000`, `XX`) as its one
   * letter (ADR 0025), and an option in the letters it has now (ADR 0031).
   */
  static parse(input: string, dictionary: Dictionary): Result<SpecId, InvalidSpecIdError> {
    const trimmed = input.trim();
    if (trimmed.length === 0) return err(new InvalidSpecIdError({ code: [messages.empty()] }));
    if (!isDottedCode(trimmed)) return SpecId.readCode(trimmed, dictionary);
    const s1 = checkS1(trimmed);
    if (s1) return err(s1);
    const parts = shortForm(trimmed).split('.');
    if (parts.length !== SLOT_COUNT) {
      return err(new InvalidSpecIdError({ code: [messages.wrongPartCount(parts.length)] }));
    }
    const written = Object.fromEntries(SLOTS.map((slot, index) => [slot.key, parts[index] ?? ''])) as SlotValues;
    return SpecId.fromSlots(live(written, dictionary), dictionary);
  }

  /** A code written today: its facts, built. Every message is about the whole code. */
  private static readCode(input: string, dictionary: Dictionary): Result<SpecId, InvalidSpecIdError> {
    const facts = readCodeFacts(input, dictionary);
    if (!facts.ok) return err(new InvalidSpecIdError({ code: facts.error }));
    const built = SpecId.build(facts.value, dictionary);
    if (built.ok) return built;
    const problems = Object.values(built.error.issues).flatMap((list) => list ?? []);
    return err(new InvalidSpecIdError({ code: problems }));
  }

  /**
   * A Spec ID from each slot's value, checked as a code is: each value on its
   * own, then against what its product type, shape and material allow.
   */
  static fromSlots(values: SlotValues, dictionary: Dictionary): Result<SpecId, InvalidSpecIdError> {
    const issues: SpecIdIssues = {};
    const passed = new Set<SlotKey>();
    for (const { key } of SLOTS) {
      const problem = checkSlotValue(key, values[key], dictionary);
      if (problem) issues[key] = [problem];
      else passed.add(key);
    }

    if (passed.has('productType')) {
      const shape = passed.has('shape') ? values.shape : undefined;
      const material = passed.has('material') ? values.material : undefined;
      for (const key of RULED_SLOTS) {
        if (!passed.has(key)) continue;
        const problem = applicabilityProblem(dictionary, values.productType, key, values[key], shape, material);
        if (problem) issues[key] = [problem];
      }
    }

    if (Object.keys(issues).length > 0) return err(new InvalidSpecIdError(issues));
    return ok(SpecId.checked(values, dictionary));
  }

  /**
   * Builds the code for what is known about a product. Every slot without a
   * value is filled for it: `X` where it doesn't apply, `Y` elsewhere. A value
   * given for a slot that doesn't apply is refused, never silently cleared.
   */
  static build(facts: SpecIdFactsInput, dictionary: Dictionary): Result<SpecId, InvalidSpecIdError> {
    const issues: SpecIdIssues = {};
    /** The slots given a value that passed its own check. */
    const given = new Map<SlotKey, string>();
    const failed = new Set<SlotKey>();
    const record = (key: SlotKey, reading: Reading | undefined) => {
      if (!reading) return;
      if (reading.problem === undefined) given.set(key, reading.raw);
      else {
        issues[key] = [reading.problem];
        failed.add(key);
      }
    };

    const productType = readProductType(facts.productType, dictionary);
    record('productType', productType);
    for (const key of CODE_SLOTS) {
      const value = facts[key];
      if (value != null) record(key, readCode(key, value, dictionary));
    }
    if (facts.capacity != null) record('capacity', readCapacity(facts.capacity, dictionary));
    for (const key of MEASURE_SLOTS) {
      const fact = facts[key];
      if (fact != null) record(key, readMeasurement(key, fact));
    }
    for (const key of COUNT_SLOTS) {
      const fact = facts[key];
      if (fact != null) record(key, readCount(key, fact));
    }

    const values: Record<SlotKey, string> = Object.fromEntries(
      SLOTS.map((slot) => [slot.key, given.get(slot.key) ?? NOT_KNOWN]),
    ) as Record<SlotKey, string>;
    values.variant = NO_VARIANT;

    if (productType.problem === undefined) {
      // A shape or material left out is not known; one that failed its check is skipped.
      const shape = failed.has('shape') ? undefined : values.shape;
      const material = failed.has('material') ? undefined : values.material;
      for (const key of RULED_SLOTS) {
        if (failed.has(key)) continue;
        const value = given.get(key);
        if (value !== undefined) {
          const problem = applicabilityProblem(dictionary, productType.raw, key, value, shape, material);
          if (problem) issues[key] = [problem];
        } else if (expectedFill(dictionary, productType.raw, key, shape, material)?.fill === 'does-not-apply') {
          values[key] = DOES_NOT_APPLY;
        }
      }
    }

    if (Object.keys(issues).length > 0) return err(new InvalidSpecIdError(issues));
    return ok(SpecId.checked(values, dictionary));
  }

  /** Values just checked against `dictionary`, whose every option has a number. */
  private static checked(values: SlotValues, dictionary: Dictionary): SpecId {
    const code = writeCode((key) => values[key], dictionary);
    if (code === null) throw new Error(`Dictionary ${dictionary.release} has an option without a number`);
    return new SpecId(values, code);
  }

  /** Rebuilds a Spec ID that was valid when it was stored, with the code stored with it. For persistence only. */
  static restore(values: SlotValues, code: string): SpecId {
    return new SpecId(values, code);
  }

  /**
   * The Spec ID a code said when it was written, not checked against today's
   * rules, for History: today's spelling, or a dotted code given out before.
   * Null when the text is not a code.
   */
  static restoreWritten(code: string, dictionary: Dictionary): SpecId | null {
    const values = writtenSlots(code, dictionary);
    if (values === null) return null;
    return new SpecId(values, writeCode((key) => values[key], dictionary) ?? code);
  }

  /** The code: each known slot's letter and number, in the standard order (ADR 0032). */
  get code(): string {
    return this.writtenCode;
  }

  /**
   * The slots as the dotted code an API before ADR 0032 wrote them, to find
   * a row an older API saves during a deploy. A decimal capacity has none.
   */
  get dottedCode(): string {
    return SLOTS.map((slot) => this.values[slot.key]).join('.');
  }

  /** A slot's value as it is stored: `BCS`, `Z0012`, `0090`, `Y`, `X`. */
  slot(key: SlotKey): string {
    return this.values[key];
  }

  /** Whether every slot holds the same value as `other`'s: one code, the same letters and markers. */
  sameSlotsAs(other: SpecId): boolean {
    return SLOTS.every(({ key }) => this.values[key] === other.slot(key));
  }

  /** The 25 slots in order, each read in plain words. */
  describe(dictionary: Dictionary): DescribedSlot[] {
    return SLOTS.map((slot) => {
      const raw = this.values[slot.key];
      const base = { number: slot.number, key: slot.key, name: slot.name, raw, part: partOf(slot.key, raw, dictionary) ?? '' };
      if (isNotKnown(raw)) return { ...base, state: 'not-known', meaning: 'Not known' };
      if (isDoesNotApply(raw)) return { ...base, state: 'does-not-apply', meaning: "Doesn't apply" };
      return { ...base, state: 'value', meaning: meaningOf(slot, raw, dictionary) };
    });
  }
}

/**
 * Checks one slot's raw text on its own — a marker, or a value's width, a
 * stray `X`, then what its kind allows — and returns the first problem, or
 * undefined. Applicability, which needs the other slots, is not checked here.
 */
export function checkSlotValue(key: SlotKey, raw: string, dictionary: Dictionary): string | undefined {
  const { name, width, kind } = slotDefinition(key);
  if (isNotKnown(raw) || isDoesNotApply(raw)) return markerProblem(key, raw);
  // A capacity with decimals is longer than its width: `Z0003.25` (ADR 0032).
  if (raw.length !== width && !(kind === 'capacity' && raw.includes('.'))) return messages.wrongWidth(name, raw, width);
  if (raw.includes(DOES_NOT_APPLY)) return messages.mixedMarker(name, raw);

  switch (kind) {
    case 'dictionary':
      return dictionary.meaningOf(key as DictionarySlotKey, raw) === undefined
        ? messages.notInDictionary(name, raw)
        : undefined;
    case 'capacity': {
      const letter = raw.slice(0, 1);
      const digits = raw.slice(1);
      if (dictionary.meaningOf('capacity', letter) === undefined) return messages.notInDictionary(name, raw);
      if (!CAPACITY_DIGITS.test(digits)) return messages.notANumber(name, raw);
      if (/^0+(?:\.0+)?$/.test(digits)) return messages.outOfRange(name, raw, capacityRange(letter, dictionary));
      return undefined;
    }
    case 'measure':
      return DIGITS.test(raw) ? undefined : messages.notANumber(name, raw);
    case 'count': {
      if (!DIGITS.test(raw)) return messages.notANumber(name, raw);
      const { max } = COUNTS[key as CountSlotKey];
      const count = Number.parseInt(raw, 10);
      return count > max ? messages.outOfRange(name, String(count), `1–${max}`) : undefined;
    }
    case 'variant':
      return messages.notInDictionary(name, raw);
  }
}

/**
 * Whether a marker may stand in this slot. Product type is always known;
 * material and the variant are in every code, so `X` is no marker for
 * material, and the variant is `X` until variants exist.
 */
function markerProblem(key: SlotKey, raw: string): string | undefined {
  const { name } = slotDefinition(key);
  if (key === 'productType') return isNotKnown(raw) ? messages.productTypeRequired() : messages.notInDictionary(name, raw);
  if (key === 'material' && isDoesNotApply(raw)) return messages.notInDictionary(name, raw);
  if (key === 'variant' && raw !== NO_VARIANT) return messages.notInDictionary(name, raw);
  return undefined;
}

/** Step 6 of reading a code: whether a slot holds what its product type, shape and material allow. */
function applicabilityProblem(
  dictionary: Dictionary,
  productType: string,
  key: RuledSlotKey,
  raw: string,
  shape: string | undefined,
  material: string | undefined,
): string | undefined {
  const expected = expectedFill(dictionary, productType, key, shape, material);
  if (!expected) return undefined;
  const { name } = slotDefinition(key);
  const product = (dictionary.meaningOf('productType', productType) ?? productType).toLowerCase();
  switch (expected.fill) {
    case 'does-not-apply':
      return isDoesNotApply(raw) ? undefined : messages.mustNotApply(name, DOES_NOT_APPLY, product);
    case 'any':
      return isDoesNotApply(raw) ? messages.mustApply(name, product) : undefined;
    case 'not-known':
      return isNotKnown(raw) ? undefined : messages.mustBeNotKnown(name, NOT_KNOWN, expected.dependsOn);
  }
}

/**
 * One fact in plain words, as its slot reads in a decoded code ("14 oz",
 * "90 mm", "Molded fibre, bagasse"), or undefined when the fact is not valid
 * on its own. Reading raw text uses it before there is a code (ADR 0026).
 */
export function meaningOfFact(
  key: SlotKey,
  fact: string | CapacityInput | MeasurementInput,
  dictionary: Dictionary,
): string | undefined {
  const slot = slotDefinition(key);
  const reading = ((): Reading | undefined => {
    switch (slot.kind) {
      case 'dictionary':
        if (typeof fact !== 'string') return undefined;
        return key === 'productType' ? readProductType(fact, dictionary) : readCode(key as DictionarySlotKey, fact, dictionary);
      case 'capacity':
        return typeof fact === 'string' ? undefined : readCapacity(fact, dictionary);
      case 'measure':
        return typeof fact === 'string' ? undefined : readMeasurement(key as MeasureSlotKey, fact);
      case 'count':
        return typeof fact === 'string' ? readCount(key as CountSlotKey, fact) : undefined;
      case 'variant':
        return undefined;
    }
  })();
  return reading === undefined || reading.problem !== undefined ? undefined : meaningOf(slot, reading.raw, dictionary);
}

function readProductType(value: string, dictionary: Dictionary): Reading {
  if (value === '' || isNotKnown(value)) return { problem: messages.productTypeRequired() };
  return readCode('productType', value, dictionary);
}

/** A dictionary code as given. A marker is not a value, so `"Y"` is refused like any unknown code. */
function readCode(key: DictionarySlotKey, value: string, dictionary: Dictionary): Reading {
  if (dictionary.meaningOf(key, value) === undefined) {
    return { problem: messages.notInDictionary(slotDefinition(key).name, value) };
  }
  return { raw: value };
}

function readCapacity(fact: CapacityInput, dictionary: Dictionary): Reading {
  const { name } = slotDefinition('capacity');
  if (dictionary.meaningOf('capacity', fact.unit) === undefined) {
    return { problem: messages.notInDictionary(name, fact.unit) };
  }
  const label = capacityLabel(fact.unit, dictionary);
  const reading = readDecimal(fact.value);
  if (!reading.ok) {
    return {
      problem:
        reading.reason === 'not-a-number'
          ? messages.notANumber(name, fact.value)
          : messages.tooManyDecimals(name, `${fact.value} ${label}`),
    };
  }
  // More than 0 and at most the most. A decimal keeps its point; 6 and 6.0 are both 6 (ADR 0032).
  const { numerator, denominator } = reading.value;
  if (numerator <= 0n || numerator > CAPACITY_MAX * denominator) {
    return { problem: messages.outOfRange(name, `${fact.value} ${label}`, capacityRange(fact.unit, dictionary)) };
  }
  const whole = numerator / denominator;
  const places = denominator.toString().length - 1;
  const decimals = (numerator % denominator).toString().padStart(places, '0').replace(/0+$/, '');
  return { raw: capacityValue(fact.unit, decimals === '' ? whole.toString() : `${whole}.${decimals}`) };
}

/** Exact decimal arithmetic, rounded half up to the slot's step (ADR 0019). */
function readMeasurement(key: MeasureSlotKey, fact: MeasurementInput): Reading {
  const { name, width } = slotDefinition(key);
  const measure = MEASURES[key];
  const factor = Object.hasOwn(measure.units, fact.unit) ? measure.units[fact.unit] : undefined;
  if (!factor) return { problem: messages.wrongUnit(name, fact.unit, measure.unitsText) };

  const withUnit = `${fact.value} ${UNIT_LABELS[fact.unit] ?? fact.unit}`;
  const reading = readDecimal(fact.value);
  if (!reading.ok) {
    return {
      problem:
        reading.reason === 'not-a-number'
          ? messages.notANumber(name, fact.value)
          : messages.tooManyDecimals(name, withUnit),
    };
  }
  const steps = roundHalfUp(multiply(reading.value, factor));
  if (steps < 1n || steps > measure.max) return { problem: messages.outOfRange(name, withUnit, measure.rangeText) };
  return { raw: steps.toString().padStart(width, '0') };
}

/** A whole number of things, 1 to the slot's most, padded to its width. */
function readCount(key: CountSlotKey, value: string): Reading {
  const { name, width } = slotDefinition(key);
  const { max } = COUNTS[key];
  const text = value.trim();
  if (!DIGITS.test(text)) return { problem: messages.notANumber(name, value) };
  const count = Number.parseInt(text, 10);
  if (count < 1 || count > max) return { problem: messages.outOfRange(name, String(count), `1–${max}`) };
  return { raw: count.toString().padStart(width, '0') };
}

/**
 * Why a code starting `S1.` cannot be converted, or undefined: one that can
 * be, or text that is not meant as an S1 code at all.
 */
function checkS1(code: string): InvalidSpecIdError | undefined {
  if (!code.startsWith('S1.')) return undefined;
  const parts = code.split('.');
  if (code.length !== S1_LENGTH || parts.length !== S1_PARTS) {
    return new InvalidSpecIdError({ code: [messages.malformedS1(code.length, parts.length)] });
  }
  const productType = parts[1] ?? '';
  if (S1_ADDED_SLOTS[productType] === undefined) {
    return new InvalidSpecIdError({ productType: [messages.notInDictionary('Product type', productType)] });
  }
  return undefined;
}

/**
 * How a capacity's unit is written after a number. The labels name S2
 * 0.1.0's units, so a unit an approved change renamed keeps its label, and a
 * unit given the letters of one renamed away has none (ADR 0031).
 */
function capacityLabel(letter: string, dictionary: Dictionary): string {
  const capacity = dictionary.renames().filter((rename) => rename.slot === 'capacity');
  const startedAs = capacity.find((rename) => rename.newCode === letter && CAPACITY_UNIT_LABELS[rename.oldCode] !== undefined);
  if (startedAs) return CAPACITY_UNIT_LABELS[startedAs.oldCode] ?? letter;
  const movedAway = capacity.some((rename) => rename.oldCode === letter);
  return (movedAway ? undefined : CAPACITY_UNIT_LABELS[letter]) ?? letter;
}

function capacityRange(letter: string, dictionary: Dictionary): string {
  return `1–${CAPACITY_MAX} ${capacityLabel(letter, dictionary)}`;
}

/** A code's slots as `dictionary` reads them now: one written before an approved change, in its live letters (ADR 0031). */
function live(values: SlotValues, dictionary: Dictionary): SlotValues {
  const now: Record<SlotKey, string> = { ...values };
  for (const key of DICTIONARY_SLOTS) {
    const written = values[key];
    now[key] = (key === 'capacity' ? dictionary.liveCapacity(written) : dictionary.live(key, written)) ?? written;
  }
  return now;
}

/** A slot holding a value, in plain words (4.5). A capacity may have decimals; every other number is whole. */
function meaningOf(slot: SlotDefinition, raw: string, dictionary: Dictionary): string {
  switch (slot.kind) {
    case 'variant':
      return raw;
    case 'dictionary':
      return dictionary.meaningOf(slot.key as DictionarySlotKey, raw) ?? raw;
    case 'capacity':
      return `${raw.slice(1).replace(/^0+(?=\d)/, '')} ${capacityLabel(raw.slice(0, 1), dictionary)}`;
    case 'count': {
      const count = Number.parseInt(raw, 10);
      const { one, many } = COUNTS[slot.key as CountSlotKey];
      return `${count} ${count === 1 ? one : many}`;
    }
    case 'measure': {
      const steps = Number.parseInt(raw, 10);
      switch (slot.key) {
        case 'unitWeight': {
          const grams = Math.trunc(steps / 10);
          const tenths = steps % 10;
          return tenths === 0 ? `${grams} g` : `${grams}.${tenths} g`;
        }
        case 'basisWeight':
          return `${steps} gsm`;
        case 'thickness':
          return `${steps} µm`;
        default:
          return `${steps} mm`;
      }
    }
  }
}
