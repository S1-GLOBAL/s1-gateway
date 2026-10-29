import type { Dictionary } from '../dictionary.js';
import { DICTIONARY_SLOTS, PAPER_FAMILY, ROUND_SHAPE, SLOTS, type DictionarySlotKey, type SlotKey } from '../slots.js';
import type { CapacityInput, MeasurementInput, SpecIdFactsInput } from '../spec-id.js';
import { KEYWORDS } from './keywords.js';
import { readSize, type Ruling } from './size-rulings.js';
import { WORD_LIST } from './word-list.js';

export interface ReadFact {
  readonly key: SlotKey;
  /** The words the fact was read from, as the text wrote them. */
  readonly words: string;
  readonly ruling: Ruling | null;
}

export interface TextReading {
  /** What was read; `productType` is set when the text names one or one is given. */
  readonly facts: Partial<SpecIdFactsInput>;
  /** In code order. */
  readonly read: readonly ReadFact[];
  /** The words no rule used, as the text wrote them, in text order. */
  readonly ignored: readonly string[];
  /** Slots the text gives two different values for: each left out of `facts`. */
  readonly conflicts: readonly { readonly key: SlotKey; readonly found: readonly string[] }[];
}

type FactValue = string | CapacityInput | MeasurementInput;

interface Match {
  readonly start: number;
  readonly end: number;
  readonly key: SlotKey;
  /**
   * A slot code, `Z14` for a capacity, or a count as digits; null for an
   * option an approved change deleted, whose words read as nothing.
   */
  readonly value: string | null;
  readonly paperOnly: boolean;
  /** How a conflict reports this value, when not as the span's own words: one end of a range. */
  readonly words?: string;
}

/** A match that reads a value. */
type ReadMatch = Match & { readonly value: string };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/**
 * A slot value written in S2 0.1.0's letters, or before an approved change,
 * as `dictionary` reads it now: null once its option is deleted (ADR 0031).
 */
function liveValue(key: SlotKey, value: string, dictionary: Dictionary): string | null {
  if (!(DICTIONARY_SLOTS as readonly SlotKey[]).includes(key)) return value;
  const slot = key as DictionarySlotKey;
  return (slot === 'capacity' ? dictionary.liveOriginalCapacity(value) : dictionary.liveOriginal(slot, value)) ?? null;
}

interface Phrase {
  readonly pattern: RegExp;
  readonly key: SlotKey;
  readonly value: (match: RegExpExecArray) => string | null;
}

/** A number before a unit's search word, as a capacity keyword reads one: `12`, `12.5`. */
const NUMBER = '(\\d+(?:\\.\\d+)?)';
const wholePhrase = (source: string) => new RegExp(`(?<![a-z0-9])${source}(?![a-z0-9])`, 'g');

/**
 * Every phrase of the word list, every product-type name, and every approved
 * search word (ADR 0026, ADR 0031), as patterns. A unit's search word is read
 * after a number, as `12 fluid ounces`.
 */
function phrases(dictionary: Dictionary): Phrase[] {
  const fixed = (value: string | null) => () => value;
  const found: Phrase[] = Object.entries(WORD_LIST).map(([phrase, meaning]) => {
    const [key, code] = 'productType' in meaning ? (['productType', meaning.productType] as const) : (['material', meaning.material] as const);
    return { pattern: wholePhrase(escape(phrase)), key, value: fixed(liveValue(key, code, dictionary)) };
  });
  for (const { code, meaning } of dictionary.valuesOf('productType')) {
    found.push({ pattern: wholePhrase(escape(meaning.toLowerCase())), key: 'productType', value: fixed(code) });
  }
  for (const { slot, word, code } of dictionary.searchWords()) {
    found.push(
      slot === 'capacity'
        ? { pattern: wholePhrase(`${NUMBER}\\s*${escape(word)}`), key: slot, value: (match) => `${code}${match[1] ?? ''}` }
        : { pattern: wholePhrase(escape(word)), key: slot, value: fixed(code) },
    );
  }
  return found;
}

function allMatches(lower: string, dictionary: Dictionary): Match[] {
  const found: Match[] = [];
  for (const { pattern, key, value } of phrases(dictionary)) {
    for (const match of lower.matchAll(pattern)) {
      found.push({ start: match.index, end: match.index + match[0].length, key, value: value(match), paperOnly: false });
    }
  }
  // Keywords name S2 0.1.0's letters: each is read as the dictionary has it now.
  for (const keyword of KEYWORDS) {
    for (const match of lower.matchAll(keyword.pattern)) {
      const span = { start: match.index, end: match.index + match[0].length, key: keyword.slot, paperOnly: keyword.paperOnly === true };
      if (keyword.ends) {
        for (const { value, words } of keyword.ends(match)) found.push({ ...span, value: liveValue(keyword.slot, value, dictionary), words });
        continue;
      }
      const value = typeof keyword.value === 'string' ? keyword.value : keyword.value(match);
      found.push({ ...span, value: liveValue(keyword.slot, value, dictionary) });
    }
  }
  // The word list and the product-type names can both name the same words ("bowl"): one match each.
  return found.filter(
    (match, index) =>
      found.findIndex((other) => other.start === match.start && other.end === match.end && other.key === match.key && other.value === match.value) === index,
  );
}

/**
 * A match inside a longer one is not read: "bowl lid" is not a bowl, and
 * "paper wrapped" is no material. The one exception is a product type, which
 * often names a material or a feature: "paper cup" is paper, "PP lid" is PP.
 */
function withoutInner<M extends Match>(matches: readonly M[]): M[] {
  return matches.filter(
    (inner) =>
      !matches.some(
        (outer) =>
          outer !== inner &&
          outer.start <= inner.start &&
          outer.end >= inner.end &&
          outer.end - outer.start > inner.end - inner.start &&
          (outer.key !== 'productType' || inner.key === 'productType'),
      ),
  );
}

function factOf(key: SlotKey, value: string): FactValue {
  if (key === 'capacity') return { unit: value.slice(0, 1), value: value.slice(1) };
  return value;
}

/** The words a span covers, as the text wrote them. */
const wordsOf = (text: string, spans: readonly { start: number; end: number }[]) =>
  spans.map(({ start, end }) => text.slice(start, end).trim()).join(' ');

/**
 * Reads the facts in raw text by rules (ADR 0026): the word list and the
 * product-type names for product type and material, plan 0006's keywords for
 * the other facts, then #28's rulings for a size. `productType` wins over any
 * the text names.
 */
export function readText(text: string, dictionary: Dictionary, productType?: string): TextReading {
  const lower = text.toLowerCase();
  // A deleted option's words still hold their place, so no shorter phrase inside them is read, but read as nothing.
  let matches = withoutInner(allMatches(lower, dictionary)).filter((match): match is ReadMatch => match.value !== null);

  const byKey = new Map<SlotKey, ReadMatch[]>();
  for (const match of matches) byKey.set(match.key, [...(byKey.get(match.key) ?? []), match]);

  const facts: Record<string, FactValue> = {};
  const conflicts: { key: SlotKey; found: string[] }[] = [];
  const decide = (key: SlotKey, found: readonly ReadMatch[]) => {
    const values = [...new Set(found.map((match) => match.value))];
    const grade = key === 'material' ? gradeOverFamily(values, dictionary) : undefined;
    const amount = key === 'capacity' ? oneAmount(values, dictionary) : undefined;
    if (values.length === 1) facts[key] = factOf(key, values[0] ?? '');
    else if (grade !== undefined) facts[key] = factOf(key, grade);
    else if (amount !== undefined) facts[key] = factOf(key, amount);
    else {
      const first = (value: string) => found.find((match) => match.value === value) as ReadMatch;
      conflicts.push({ key, found: values.map((value) => first(value).words ?? wordsOf(text, [first(value)])) });
    }
  };
  for (const key of ['productType', 'material'] as const) {
    const found = byKey.get(key);
    if (found) decide(key, found);
  }
  if (productType !== undefined) facts.productType = productType;

  // Kraft is brown only on paper: a colour read from "kraft" waits for a paper material.
  const material = typeof facts.material === 'string' ? facts.material : undefined;
  matches = matches.filter((match) => !match.paperOnly || material?.startsWith(PAPER_FAMILY) === true);
  for (const [key, found] of byKey) {
    if (key === 'productType' || key === 'material') continue;
    const kept = found.filter((match) => matches.includes(match));
    if (kept.length > 0) decide(key, kept);
  }

  const rulings = new Map<SlotKey, Ruling>();
  const used = matches.map(({ start, end }) => ({ start, end }));
  const type = typeof facts.productType === 'string' ? facts.productType : undefined;
  if (type !== undefined) {
    let masked = lower;
    for (const { start, end } of used) masked = masked.slice(0, start) + ' '.repeat(end - start) + masked.slice(end);
    const size = readSize(masked, type, dictionary);
    const roundShape = dictionary.liveOriginal('shape', ROUND_SHAPE);
    const round = size?.facts.shape === roundShape;
    if (size && !(round && facts.shape !== undefined && facts.shape !== roundShape)) {
      const start = masked.indexOf(size.words);
      used.push({ start, end: start + size.words.length });
      // The same size written again is used too, so it is not left out.
      let from = start + size.words.length;
      for (const repeat of size.repeats ?? []) {
        const at = masked.indexOf(repeat, from);
        if (at === -1) continue;
        used.push({ start: at, end: at + repeat.length });
        from = at + repeat.length;
      }
      for (const [key, value] of Object.entries(size.facts) as [SlotKey, FactValue][]) {
        if (facts[key] !== undefined) continue;
        facts[key] = value;
        rulings.set(key, size.ruling);
      }
    }
  }

  const read: ReadFact[] = SLOTS.filter((slot) => facts[slot.key] !== undefined).map(({ key }) => {
    const ruling = rulings.get(key) ?? null;
    const spans = ruling === null ? matches.filter((match) => match.key === key) : used.slice(-1);
    return { key, words: wordsOf(text, spans), ruling };
  });

  const covered = (start: number, end: number) => used.some((span) => span.start < end && start < span.end);
  const ignored = [...text.matchAll(/\S+/g)]
    .filter((token) => !covered(token.index, token.index + token[0].length))
    .map((token) => token[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => word.length > 0);

  return { facts: facts as Partial<SpecIdFactsInput>, read, ignored, conflicts };
}

/** Millilitres in one fluid ounce, US. */
const ML_PER_OZ = 29.5735;

/**
 * The first of two capacities that are one amount in two units: `5 oz (150
 * ML)` is 5 oz, since 5 oz is 148 mL. Within a tenth, as a trade size rounds;
 * undefined otherwise, so `5 oz` and `500 ml` are still left out.
 */
function oneAmount(values: readonly string[], dictionary: Dictionary): string | undefined {
  const [first, second] = values;
  if (values.length !== 2 || first === undefined || second === undefined) return undefined;
  const ounces = dictionary.liveOriginal('capacity', 'Z');
  const millilitres = dictionary.liveOriginal('capacity', 'M');
  const inMl = (value: string) => {
    const amount = Number(value.slice(1));
    if (millilitres !== undefined && value.startsWith(millilitres)) return amount;
    return ounces !== undefined && value.startsWith(ounces) ? amount * ML_PER_OZ : Number.NaN;
  };
  const [a, b] = [inMl(first), inMl(second)];
  if (Number.isNaN(a) || Number.isNaN(b) || first.slice(0, 1) === second.slice(0, 1)) return undefined;
  return Math.abs(a - b) <= 0.1 * Math.max(a, b) ? first : undefined;
}

/**
 * Paper and plastic of unknown grade, as S2 0.1.0 names them: a text that
 * names one beside one grade of the same family means that grade.
 */
const FAMILY_WORDS = ['B00', 'A00'] as const;

/**
 * The one specific material among `values` when the rest only name its family
 * ("Paper" beside "White Kraft", "Plastic" beside "PET"); undefined otherwise,
 * so two grades ("PET" and "PP") are still left out.
 */
function gradeOverFamily(values: readonly string[], dictionary: Dictionary): string | undefined {
  const families = FAMILY_WORDS.map((code) => dictionary.liveOriginal('material', code)).filter(
    (code): code is string => code !== undefined,
  );
  const grades = values.filter((value) => !families.includes(value));
  const [grade] = grades;
  if (grades.length !== 1 || grade === undefined || grades.length === values.length) return undefined;
  const family = (code: string) => code.slice(0, 1);
  return values.every((value) => value === grade || family(value) === family(grade)) ? grade : undefined;
}
