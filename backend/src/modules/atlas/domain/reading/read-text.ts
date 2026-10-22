import type { Dictionary } from '../dictionary.js';
import { PAPER_FAMILY, SLOTS, type SlotKey } from '../slots.js';
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
  /** A slot code, `Z14` for a capacity, or a count as digits. */
  readonly value: string;
  readonly paperOnly: boolean;
  /** How a conflict reports this value, when not as the span's own words: one end of a range. */
  readonly words?: string;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/** Every phrase of the word list and every product-type name, as patterns, longest first. */
function phrases(dictionary: Dictionary): { pattern: RegExp; key: SlotKey; value: string }[] {
  const entries = Object.entries(WORD_LIST).map(([phrase, meaning]) =>
    'productType' in meaning
      ? { phrase, key: 'productType' as const, value: meaning.productType }
      : { phrase, key: 'material' as const, value: meaning.material },
  );
  for (const { code, meaning } of dictionary.valuesOf('productType')) {
    entries.push({ phrase: meaning.toLowerCase(), key: 'productType', value: code });
  }
  return entries.map(({ phrase, key, value }) => ({
    pattern: new RegExp(`(?<![a-z0-9])${escape(phrase)}(?![a-z0-9])`, 'g'),
    key,
    value,
  }));
}

function allMatches(lower: string, dictionary: Dictionary): Match[] {
  const found: Match[] = [];
  for (const { pattern, key, value } of phrases(dictionary)) {
    for (const match of lower.matchAll(pattern)) {
      found.push({ start: match.index, end: match.index + match[0].length, key, value, paperOnly: false });
    }
  }
  for (const keyword of KEYWORDS) {
    for (const match of lower.matchAll(keyword.pattern)) {
      const span = { start: match.index, end: match.index + match[0].length, key: keyword.slot, paperOnly: keyword.paperOnly === true };
      if (keyword.ends) {
        for (const { value, words } of keyword.ends(match)) found.push({ ...span, value, words });
        continue;
      }
      const value = typeof keyword.value === 'string' ? keyword.value : keyword.value(match);
      found.push({ ...span, value });
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
function withoutInner(matches: readonly Match[]): Match[] {
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
  let matches = withoutInner(allMatches(lower, dictionary));

  const byKey = new Map<SlotKey, Match[]>();
  for (const match of matches) byKey.set(match.key, [...(byKey.get(match.key) ?? []), match]);

  const facts: Record<string, FactValue> = {};
  const conflicts: { key: SlotKey; found: string[] }[] = [];
  const decide = (key: SlotKey, found: readonly Match[]) => {
    const values = [...new Set(found.map((match) => match.value))];
    if (values.length === 1) facts[key] = factOf(key, values[0] ?? '');
    else {
      const first = (value: string) => found.find((match) => match.value === value) as Match;
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
    const size = readSize(masked, type);
    const round = size?.facts.shape === 'RD';
    if (size && !(round && facts.shape !== undefined && facts.shape !== 'RD')) {
      const start = masked.indexOf(size.words);
      used.push({ start, end: start + size.words.length });
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
