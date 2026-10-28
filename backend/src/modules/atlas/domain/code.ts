import { err, ok, type Result } from '../../../shared/domain/result.js';
import { expectedFill, isDoesNotApply, isNotKnown } from './applicability.js';
import type { Dictionary } from './dictionary.js';
import { readDecimal } from './measurement.js';
import { shortForm } from './old-codes.js';
import type { FactDraft, MeasurementInput } from './spec-id-facts.js';
import {
  CAPACITY_MAX,
  DICTIONARY_SLOTS,
  DOES_NOT_APPLY,
  NO_VARIANT,
  NOT_KNOWN,
  RULED_SLOTS,
  SLOT_COUNT,
  SLOTS,
  slotDefinition,
  type CountSlotKey,
  type DictionarySlotKey,
  type MeasureSlotKey,
  type SlotKey,
} from './slots.js';

/*
 * How a Spec ID is written (ADR 0032). One letter per known fact, then its
 * number: a dictionary option's number in its list, or a size's amount. The
 * facts in words come first; one hyphen, then capacity and the measurements.
 * A slot not known, or that doesn't apply, is left out, and so is the variant.
 * `A5B17D3E1Q2R3-G112H90J110` is a cup of paper cup stock, white, round,
 * double wall, printed in 2 colours, 12 oz, 90 mm across the top, 110 mm high.
 */

/** A slot a code can write. The variant is never written. */
export type CodedSlotKey = Exclude<SlotKey, 'variant'>;

export interface CodeLetter {
  readonly letter: string;
  readonly slot: CodedSlotKey;
}

/** One letter per slot, A to X, in slot number order. */
export const CODE_LETTERS: readonly CodeLetter[] = [
  { letter: 'A', slot: 'productType' },
  { letter: 'B', slot: 'material' },
  { letter: 'C', slot: 'coating' },
  { letter: 'D', slot: 'colourClarity' },
  { letter: 'E', slot: 'shape' },
  { letter: 'F', slot: 'profile' },
  { letter: 'G', slot: 'capacity' },
  { letter: 'H', slot: 'topDiameter' },
  { letter: 'I', slot: 'bottomDiameter' },
  { letter: 'J', slot: 'height' },
  { letter: 'K', slot: 'length' },
  { letter: 'L', slot: 'width' },
  { letter: 'M', slot: 'gusset' },
  { letter: 'N', slot: 'unitWeight' },
  { letter: 'O', slot: 'basisWeight' },
  { letter: 'P', slot: 'thickness' },
  { letter: 'Q', slot: 'wall' },
  { letter: 'R', slot: 'print' },
  { letter: 'S', slot: 'compartments' },
  { letter: 'T', slot: 'plies' },
  { letter: 'U', slot: 'lidOpening' },
  { letter: 'V', slot: 'handle' },
  { letter: 'W', slot: 'wrap' },
  { letter: 'X', slot: 'window' },
];

const LETTER_OF = new Map<SlotKey, string>(CODE_LETTERS.map(({ letter, slot }) => [slot, letter]));
const SLOT_OF = new Map<string, CodedSlotKey>(CODE_LETTERS.map(({ letter, slot }) => [letter, slot]));

/** The letter a slot is written with: `B` for material. */
export function letterOf(slot: CodedSlotKey): string {
  return LETTER_OF.get(slot) ?? '';
}

/** The slot a letter writes, or undefined: `Y`, `Z` and anything else that is not a letter of the code. */
export function slotOfLetter(letter: string): CodedSlotKey | undefined {
  return SLOT_OF.get(letter);
}

/** Capacity and the measurements: written after the hyphen. */
export const SIZE_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>([
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

/**
 * Whether text is a code given out before ADR 0032: `S1.` or `S2.`, or a dot
 * that is not between two digits. A dot between digits is a capacity's point,
 * as in `G13.25`.
 */
export function isDottedCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes('.')) return false;
  if (/^S[12]\./i.test(trimmed)) return true;
  return /[^0-9]\.|\.[^0-9]|^\.|\.$/.test(trimmed);
}

/**
 * How one slot's value is written in the code: `B17`, `G13.25`, `H90`. Empty
 * for a slot not known or that doesn't apply, and for the variant. Undefined
 * when the dictionary has no number for the option, even through a rename or
 * as a deleted option's number.
 */
export function partOf(key: SlotKey, raw: string, dictionary: Dictionary): string | undefined {
  if (key === 'variant' || isNotKnown(raw) || isDoesNotApply(raw)) return '';
  const letter = letterOf(key);
  const { kind } = slotDefinition(key);
  switch (kind) {
    case 'dictionary': {
      const number = numberOfLetters(key as DictionarySlotKey, raw, dictionary);
      return number === undefined ? undefined : `${letter}${number}`;
    }
    case 'capacity': {
      const unit = numberOfLetters('capacity', raw.slice(0, 1), dictionary);
      return unit === undefined ? undefined : `${letter}${unit}${withoutLeadingZeros(raw.slice(1))}`;
    }
    case 'measure':
    case 'count':
      return `${letter}${withoutLeadingZeros(raw)}`;
    case 'variant':
      return '';
  }
}

/**
 * The code for a Spec ID's slots, in the standard order, or null when an
 * option has no number in `dictionary`.
 */
export function writeCode(valueOf: (key: SlotKey) => string, dictionary: Dictionary): string | null {
  const facts: string[] = [];
  const sizes: string[] = [];
  for (const { key } of SLOTS) {
    const part = partOf(key, valueOf(key), dictionary);
    if (part === undefined) return null;
    if (part === '') continue;
    if (SIZE_SLOTS.has(key)) sizes.push(part);
    else facts.push(part);
  }
  return sizes.length === 0 ? facts.join('') : `${facts.join('')}-${sizes.join('')}`;
}

/**
 * An option's number from the letters a slot holds: the live option's, the
 * option an approved change renamed them to, or the deleted option's that
 * had them (ADR 0031, ADR 0032).
 */
function numberOfLetters(slot: DictionarySlotKey, letters: string, dictionary: Dictionary): number | undefined {
  const live = dictionary.numberOf(slot, letters);
  if (live !== undefined) return live;
  const renamed = dictionary.live(slot, letters);
  if (renamed !== undefined && renamed !== letters) return dictionary.numberOf(slot, renamed);
  return dictionary.retired().find((retired) => retired.slot === slot && retired.code === letters)?.number;
}

/** `0090` is `90`; `0003.25` is `3.25`; `0000.5` is `0.5`. */
function withoutLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}

interface Token {
  readonly slot: CodedSlotKey;
  /** The digits after the letter; a capacity's may hold one point. */
  readonly digits: string;
}

/** The letters and numbers of a code, or the reasons it cannot be cut into them. */
function scan(text: string): Result<Token[], string[]> {
  if (!/^[A-Z0-9.-]+$/.test(text)) return err([messages.characters()]);
  if (text.split('-').length > 2) return err([messages.hyphens()]);
  const joined = text.replace('-', '');
  const problems: string[] = [];
  const tokens: Token[] = [];
  let index = 0;
  while (index < joined.length) {
    const letter = joined.charAt(index);
    if (!isLetter(letter)) return err([messages.numberFirst()]);
    let end = index + 1;
    while (isDigit(joined.charAt(end))) end += 1;
    if (letter === 'G' && joined.charAt(end) === '.' && isDigit(joined.charAt(end + 1))) {
      end += 1;
      while (isDigit(joined.charAt(end))) end += 1;
    }
    const digits = joined.slice(index + 1, end);
    const slot = slotOfLetter(letter);
    if (slot === undefined) problems.push(messages.notALetter(letter));
    else if (digits.length === 0) problems.push(messages.noValue(slot));
    else tokens.push({ slot, digits });
    index = end;
  }
  return problems.length > 0 ? err(problems) : ok(tokens);
}

/**
 * The facts a code written today says, refusing anything it cannot say:
 * a letter that is not the code's, a slot given twice, no product type, a
 * number the dictionary does not have, or a slot this product doesn't have.
 * Letters may come in any order and either case. Whether each value is in
 * range is the Spec ID's to check when it is built.
 */
export function readCodeFacts(input: string, dictionary: Dictionary): Result<FactDraft & { productType: string }, string[]> {
  const text = input.trim().toUpperCase();
  const scanned = scan(text);
  if (!scanned.ok) return scanned;

  const problems: string[] = [];
  const seen = new Set<SlotKey>();
  for (const token of scanned.value) {
    if (seen.has(token.slot)) problems.push(messages.twice(token.slot));
    seen.add(token.slot);
  }
  if (!seen.has('productType')) problems.push(messages.noProductType());
  if (problems.length > 0) return err(problems);

  const facts: FactDraft = {};
  for (const { slot, digits } of scanned.value) {
    const { kind, name } = slotDefinition(slot);
    if (kind === 'capacity') {
      const unit = dictionary.valueNumbered('capacity', Number(digits.slice(0, 1)))?.code;
      const amount = capacityAmount(digits.slice(1));
      if (unit === undefined || amount === undefined) problems.push(messages.capacity());
      else facts.capacity = { unit, value: amount };
      continue;
    }
    const number = positiveInteger(digits);
    if (number === undefined) {
      problems.push(messages.notAValue(name, digits));
    } else if (kind === 'dictionary') {
      const code = dictionary.valueNumbered(slot as DictionarySlotKey, number)?.code;
      if (code === undefined) problems.push(messages.notInDictionary(name, number));
      else Object.assign(facts, { [slot]: code });
    } else if (kind === 'measure') {
      Object.assign(facts, { [slot]: measurement(slot as MeasureSlotKey, number) });
    } else if (kind === 'count') {
      Object.assign(facts, { [slot as CountSlotKey]: String(number) });
    }
  }
  const productType = facts.productType;
  if (problems.length > 0 || productType === undefined) return err(problems);

  const product = (dictionary.meaningOf('productType', productType) ?? productType).toLowerCase();
  for (const key of RULED_SLOTS) {
    if (!seen.has(key)) continue;
    const expected = expectedFill(dictionary, productType, key, facts.shape ?? NOT_KNOWN, facts.material ?? NOT_KNOWN);
    if (!expected || expected.fill === 'any') continue;
    problems.push(
      expected.fill === 'not-known'
        ? messages.waitsOn(slotDefinition(key).name, expected.dependsOn)
        : messages.doesNotApply(slotDefinition(key).name, product),
    );
  }
  return problems.length > 0 ? err(problems) : ok({ ...facts, productType });
}

/**
 * Each slot's value in a code written at any time: today's spelling, or a
 * dotted code given out before (ADR 0024, ADR 0025), its options in today's
 * letters where an approved change renamed them. Nothing is checked against
 * today's rules, so a code that was valid when it was written still reads.
 * A slot a code leaves out is `X` where its product doesn't have it, and
 * `Y` otherwise. Null when the text is not a code.
 */
export function writtenSlots(input: string, dictionary: Dictionary): Record<SlotKey, string> | null {
  const text = input.trim().toUpperCase();
  if (text.length === 0) return null;
  if (isDottedCode(text)) {
    const parts = shortForm(text).split('.');
    if (parts.length !== SLOT_COUNT) return null;
    const values = Object.fromEntries(SLOTS.map((slot, index) => [slot.key, parts[index] ?? ''])) as Record<SlotKey, string>;
    for (const key of DICTIONARY_SLOTS) {
      const written = values[key];
      values[key] = (key === 'capacity' ? dictionary.liveCapacity(written) : dictionary.live(key, written)) ?? written;
    }
    return values;
  }

  const scanned = scan(text);
  if (!scanned.ok) return null;
  const given = new Map<SlotKey, string>();
  for (const { slot, digits } of scanned.value) {
    const raw = writtenValue(slot, digits, dictionary);
    if (raw === undefined || given.has(slot)) return null;
    given.set(slot, raw);
  }
  const productType = given.get('productType');
  if (productType === undefined) return null;
  const values = Object.fromEntries(SLOTS.map(({ key }) => [key, given.get(key) ?? NOT_KNOWN])) as Record<SlotKey, string>;
  values.variant = NO_VARIANT;
  for (const key of RULED_SLOTS) {
    if (given.has(key)) continue;
    const fill = expectedFill(dictionary, productType, key, values.shape, values.material);
    if (fill?.fill === 'does-not-apply') values[key] = DOES_NOT_APPLY;
  }
  return values;
}

/** One part's value as a slot holds it, a deleted option's by the letters it had; undefined when unreadable. */
function writtenValue(slot: CodedSlotKey, digits: string, dictionary: Dictionary): string | undefined {
  const { kind, width } = slotDefinition(slot);
  const lettersOf = (list: DictionarySlotKey, number: number): string | undefined =>
    dictionary.valueNumbered(list, number)?.code ?? dictionary.retiredNumbered(list, number)?.code;
  if (kind === 'capacity') {
    const unit = lettersOf('capacity', Number(digits.slice(0, 1)));
    const amount = capacityAmount(digits.slice(1));
    return unit === undefined || amount === undefined ? undefined : capacityValue(unit, amount);
  }
  const number = positiveInteger(digits);
  if (number === undefined) return undefined;
  if (kind === 'dictionary') return lettersOf(slot as DictionarySlotKey, number);
  return String(number).padStart(width, '0');
}

/** The code `input` is in today's spelling and standard order, whenever it was written; null when it is not a code. */
export function codeInToday(input: string, dictionary: Dictionary): string | null {
  const values = writtenSlots(input, dictionary);
  return values === null ? null : writeCode((key) => values[key], dictionary);
}

/**
 * A capacity amount as a code keeps it: greater than 0, at most 9999, at
 * most 6 decimal places. A whole amount is written whole (`6.0` is `6`), a
 * decimal keeps its point (`3.25`), and leading zeros drop (`03.25`).
 */
export function capacityAmount(text: string): string | undefined {
  const reading = readDecimal(text);
  if (!reading.ok) return undefined;
  const { numerator, denominator } = reading.value;
  if (numerator <= 0n || numerator > CAPACITY_MAX * denominator) return undefined;
  const whole = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return whole.toString();
  const places = denominator.toString().length - 1;
  return `${whole}.${remainder.toString().padStart(places, '0').replace(/0+$/, '')}`;
}

/** A capacity as its slot holds it: the unit's letters, the whole part as four digits, then any decimals. `Z0003.25`. */
export function capacityValue(unit: string, amount: string): string {
  const [whole = '', decimals] = amount.split('.');
  return `${unit}${whole.padStart(4, '0')}${decimals === undefined ? '' : `.${decimals}`}`;
}

/** A size in its slot's unit from the number a code writes: `N33` is 3.3 g. */
export function measurement(slot: MeasureSlotKey, steps: number): MeasurementInput {
  if (slot === 'unitWeight') {
    const whole = Math.trunc(steps / 10);
    const tenths = steps % 10;
    return { value: tenths === 0 ? String(whole) : `${whole}.${tenths}`, unit: 'g' };
  }
  if (slot === 'basisWeight') return { value: String(steps), unit: 'gsm' };
  if (slot === 'thickness') return { value: String(steps), unit: 'um' };
  return { value: String(steps), unit: 'mm' };
}

function positiveInteger(digits: string): number | undefined {
  if (!/^\d+$/.test(digits)) return undefined;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}

function isLetter(character: string): boolean {
  return character >= 'A' && character <= 'Z';
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

/** Every message reading a code can give. */
export const codeMessages = {
  characters: (): string => 'A Spec ID uses letters, numbers and one hyphen.',
  hyphens: (): string => 'A Spec ID has one hyphen, before the sizes.',
  numberFirst: (): string => 'A code is letters and numbers, like A5B17. This one has a number before its letter.',
  notALetter: (letter: string): string => `${letter} is not a letter of the code.`,
  noValue: (slot: CodedSlotKey): string => {
    const letter = letterOf(slot);
    return `${slotDefinition(slot).name} (${letter}) has no value. Write a number after ${letter}, for example ${letter}1.`;
  },
  twice: (slot: SlotKey): string => `${slotDefinition(slot).name} is given twice.`,
  noProductType: (): string => 'Product type (A) is missing. Every code includes it, for example A1.',
  capacity: (): string => 'Nominal capacity: write a unit digit then the amount, for example G112 for 12 oz.',
  notAValue: (slot: string, digits: string): string => `${slot}: ${digits} is not a value.`,
  notInDictionary: (slot: string, number: number): string => `${slot}: ${number} is not in the dictionary.`,
  doesNotApply: (slot: string, product: string): string => `${slot} doesn't apply to a ${product}. Leave it out.`,
  waitsOn: (slot: string, dependsOn: string): string =>
    `${slot} can't be set while the ${dependsOn} is not known. Add the ${dependsOn}, or leave ${slot.toLowerCase()} out.`,
};

const messages = codeMessages;
