import { expectedFill, type ExpectedFill } from './applicability.js';
import type { Dictionary, DictionaryValue } from './dictionary.js';
import type { TextReading } from './reading/read-text.js';
import { WORD_LIST } from './reading/word-list.js';
import type { SpecIdFactsInput } from './spec-id.js';
import {
  CAPACITY_UNIT_LABELS,
  COUNTS,
  MEASURES,
  UNIT_LABELS,
  slotDefinition,
  type CountSlotKey,
  type DictionarySlotKey,
  type MeasureSlotKey,
  type RuledSlotKey,
  type SlotKey,
} from './slots.js';
import { V2_CAPACITY_DIGIT_BY_UNIT, V2_LETTERS } from './tagged-spec-id-v2.js';

/**
 * What a leftover word could still be, drawn from the whole dictionary.
 * A named slot lists every issued value. A number slot shows the pattern,
 * and uses a number written beside the word when there is one.
 */

interface Numbering {
  numberOf(slot: DictionarySlotKey, code: string): number | undefined;
}

/** A writable copy of the facts while a code is being read. `SpecIdFactsInput` itself is read-only. */
export type FactDraft = {
  -readonly [K in keyof SpecIdFactsInput]?: SpecIdFactsInput[K];
};

/** The fact a slot holds. The variant is a slot of the code, not a fact, so it holds nothing. */
export function factIn(facts: Partial<SpecIdFactsInput>, slot: SlotKey): SpecIdFactsInput[keyof SpecIdFactsInput] {
  return slot === 'variant' ? undefined : facts[slot];
}

interface Hit {
  readonly slot: DictionarySlotKey;
  readonly code: string;
  readonly meaning: string;
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

const PRINT_WORDS = new Set(['print', 'printed', 'printing']);

const COLOUR_WORDS = new Set(['color', 'colour']);

const COLOURS_WORDS = new Set(['colors', 'colours']);

const NAMED_WORDS: Readonly<Record<string, DictionarySlotKey>> = {
  coating: 'coating',
  coated: 'coating',
  shape: 'shape',
  profile: 'profile',
  wall: 'wall',
  walls: 'wall',
  handle: 'handle',
  handles: 'handle',
  wrap: 'wrap',
  wrapped: 'wrap',
  wrapping: 'wrap',
  opening: 'lidOpening',
  window: 'window',
  windows: 'window',
};

const COUNT_WORDS: Readonly<Record<string, CountSlotKey>> = {
  comp: 'compartments',
  compartment: 'compartments',
  compartments: 'compartments',
  ply: 'plies',
  plies: 'plies',
};

const NAMED_MEASURES: readonly { readonly slot: MeasureSlotKey; readonly name: string; readonly unit: string }[] = [
  { slot: 'topDiameter', name: 'top\\s+diameters?', unit: 'mm' },
  { slot: 'bottomDiameter', name: 'bottom\\s+diameters?', unit: 'mm' },
  { slot: 'unitWeight', name: 'unit\\s+weights?', unit: 'g' },
  { slot: 'basisWeight', name: 'basis\\s+weights?', unit: 'gsm' },
  { slot: 'thickness', name: 'micrometres?|micrometers?|microns?|thickness', unit: 'um' },
  { slot: 'height', name: 'heights?', unit: 'mm' },
  { slot: 'length', name: 'lengths?', unit: 'mm' },
  { slot: 'width', name: 'widths?', unit: 'mm' },
  { slot: 'gusset', name: 'gussets?', unit: 'mm' },
];

/** A unit that names one slot on its own: 280 gsm is basis weight, 350 µm is thickness. */
const UNIT_MEASURES: readonly { readonly slot: MeasureSlotKey; readonly unit: string; readonly pattern: string }[] = [
  { slot: 'basisWeight', unit: 'gsm', pattern: 'gsm' },
  { slot: 'thickness', unit: 'um', pattern: 'um|µm|microns?|micrometres?|micrometers?' },
];

const NAMED_COUNTS: readonly { readonly slot: CountSlotKey; readonly name: string }[] = [
  { slot: 'compartments', name: 'compartments?|comp' },
  { slot: 'plies', name: 'plies|ply' },
];

const NAMED_CAPACITIES: readonly { readonly unit: string; readonly name: string }[] = [
  { unit: 'Z', name: 'ounces?|oz' },
  { unit: 'M', name: 'millilitres?|milliliters?|ml' },
  { unit: 'S', name: 'servings?' },
  { unit: 'N', name: 'counts?' },
];

const MEASURE_WORDS: Readonly<Record<string, MeasureSlotKey>> = {
  height: 'height',
  length: 'length',
  width: 'width',
  gusset: 'gusset',
  gussets: 'gusset',
  thickness: 'thickness',
  micron: 'thickness',
  microns: 'thickness',
  micrometre: 'thickness',
  micrometres: 'thickness',
  micrometer: 'thickness',
  micrometers: 'thickness',
  um: 'thickness',
  gsm: 'basisWeight',
  basis: 'basisWeight',
};

const CAPACITY_WORDS: Readonly<Record<string, string | 'all'>> = {
  capacity: 'all',
  ounce: 'Z',
  ounces: 'Z',
  oz: 'Z',
  millilitre: 'M',
  millilitres: 'M',
  milliliter: 'M',
  milliliters: 'M',
  ml: 'M',
  serving: 'S',
  servings: 'S',
};

const SAMPLE_MM = '40';
const SAMPLE_GRAMS = '3.3';
const SAMPLE_GSM = '280';
const SAMPLE_UM = '350';
const SAMPLE_OZ = '12';

/**
 * Adjacent words that together are one dictionary entry become that entry.
 * The match is the entry's own name, for every slot: "Polymer HDPE" is
 * Polymer, HDPE, and "Polymer PET" is Polymer, PET. A family word alone
 * stays a suggestion, because it names many entries.
 */
export function combineAdjacent(
  text: string,
  reading: TextReading,
  dictionary: Dictionary,
  numbering: Numbering,
): { readonly facts: Partial<SpecIdFactsInput>; readonly ignored: readonly string[]; readonly warnings: readonly string[] } {
  const index = hitIndex(dictionary);
  const marks = align(text, reading.ignored);
  const consumed = new Set<number>();
  const adopted: { readonly hit: Hit; readonly phrase: string; readonly words: readonly string[] }[] = [];

  for (let start = 0; start < marks.length; start += 1) {
    if (marks[start]?.kind === 'stop') continue;
    const words: string[] = [];
    const indexes: number[] = [];
    let best: { readonly end: number; readonly hit: Hit; readonly indexes: readonly number[]; readonly words: readonly string[] } | undefined;
    for (let end = start; end < marks.length; end += 1) {
      const mark = marks[end];
      if (mark === undefined) break;
      if (mark.kind === 'stop') continue;
      words.push(mark.token);
      if (mark.kind === 'ignored') indexes.push(mark.ignoredIndex);
      if (words.length < 2) continue;
      const hits = commonHits(words, index).filter((hit) => meaningHas(hit, words));
      if (hits.length === 0) break;
      const hit = hits.length === 1 ? hits[0] : undefined;
      if (hit !== undefined && indexes.length > 0) best = { end, hit, indexes: [...indexes], words: [...words] };
    }
    if (best === undefined || best.indexes.every((ignoredIndex) => consumed.has(ignoredIndex))) continue;
    for (const ignoredIndex of best.indexes) consumed.add(ignoredIndex);
    adopted.push({
      hit: best.hit,
      words: best.words,
      phrase: best.indexes.map((ignoredIndex) => reading.ignored[ignoredIndex] ?? '').join(' '),
    });
    start = best.end;
  }

  return settle(adopted, consumed, reading, numbering);
}

/**
 * A number written beside the part it describes is that value.
 * "40mm gusset" is a 40 mm gusset, "3 compartments" is three compartments,
 * and "12 servings" is a capacity. The same reading covers every numbered slot.
 */
export function readNamedMeasures(
  text: string,
  reading: TextReading,
  dictionary: Dictionary,
): { readonly facts: Partial<SpecIdFactsInput>; readonly ignored: readonly string[]; readonly warnings: readonly string[] } {
  const facts: FactDraft = {};
  const warnings: string[] = [];
  const taken: string[] = [];
  const hits = findNamedFacts(text);
  const measures = new Map<MeasureSlotKey, NamedFact[]>();
  const counts = new Map<CountSlotKey, NamedFact[]>();
  const capacities: NamedFact[] = [];
  for (const hit of hits) {
    if (hit.kind === 'measure') {
      const list = measures.get(hit.slot) ?? [];
      list.push(hit);
      measures.set(hit.slot, list);
    } else if (hit.kind === 'count') {
      const list = counts.get(hit.slot) ?? [];
      list.push(hit);
      counts.set(hit.slot, list);
    } else capacities.push(hit);
  }

  for (const [slot, list] of measures) keepNamed(slot, list, reading, dictionary, facts, warnings, taken, (hit) => {
    if (hit.kind === 'measure') writeMeasure(facts, slot, hit.value, hit.unit);
  });
  for (const [slot, list] of counts) {
    keepNamed(slot, list, reading, dictionary, facts, warnings, taken, (hit) => {
      if (slot === 'compartments') facts.compartments = hit.value;
      else facts.plies = hit.value;
    });
  }
  keepNamed('capacity', capacities, reading, dictionary, facts, warnings, taken, (hit) => {
    if (hit.kind === 'capacity') facts.capacity = { unit: hit.unit, value: hit.value };
  });
  adoptLooseGrams(text, hits, reading, dictionary, facts, warnings, taken);

  return { facts, ignored: without(reading.ignored, taken), warnings };
}

/**
 * A dictionary value whose own name is written in the text is that value,
 * for every slot. "Translucent" is the colour, "Closed" is the lid opening,
 * "Wax coated" is the coating. A single word that also belongs to another
 * value stays a suggestion.
 */
export function readIssuedMeanings(
  text: string,
  reading: TextReading,
  dictionary: Dictionary,
): { readonly facts: Partial<SpecIdFactsInput>; readonly ignored: readonly string[]; readonly warnings: readonly string[] } {
  const facts: Partial<SpecIdFactsInput> = {};
  const warnings: string[] = [];
  const taken: string[] = [];
  const values = dictionary.values().filter((value) => value.slot !== 'capacity');
  const found: MeaningMatch[] = [];
  for (const value of values) {
    const words = tokens(value.meaning.toLowerCase());
    if (words.length === 0) continue;
    if (words.length === 1 && values.some((other) => (other.slot !== value.slot || other.code !== value.code) && tokens(other.meaning.toLowerCase()).includes(words[0] ?? ''))) {
      continue;
    }
    const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9]+');
    for (const match of text.matchAll(new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, 'gi'))) {
      if (match.index === undefined) continue;
      found.push({ slot: value.slot, code: value.code, meaning: value.meaning, start: match.index, end: match.index + match[0].length, span: match[0], words });
    }
  }
  found.sort((left, right) => right.end - right.start - (left.end - left.start) || left.start - right.start);
  const kept: MeaningMatch[] = [];
  for (const hit of found) {
    if (kept.some((other) => other.start < hit.end && hit.start < other.end)) continue;
    kept.push(hit);
  }
  const bySlot = new Map<DictionarySlotKey, MeaningMatch[]>();
  for (const hit of kept) {
    const list = bySlot.get(hit.slot) ?? [];
    list.push(hit);
    bySlot.set(hit.slot, list);
  }
  for (const [slot, list] of bySlot) {
    for (const hit of list) taken.push(...pieces(hit.span));
    const blocked = block(slot, slotDefinition(slot).name, reading.facts, dictionary);
    if (blocked !== undefined) {
      if (!warnings.includes(blocked)) warnings.push(blocked);
      continue;
    }
    const codes = [...new Set(list.map((hit) => hit.code))];
    const existing = reading.facts[slot];
    const existingCode = typeof existing === 'string' ? existing : undefined;
    if (codes.length > 1 || (existingCode !== undefined && !codes.every((code) => code === existingCode) && !list.every((hit) => factInside(reading, slot, hit.words)))) {
      const sides = list.map((hit) => `${hit.span} is ${hit.meaning}`).join(' and ');
      warnings.push(`${slotDefinition(slot).name} was given as ${sides}, so it was left out.`);
      continue;
    }
    const hit = list[0];
    if (hit === undefined || existingCode === hit.code) continue;
    (facts as Record<string, string>)[slot] = hit.code;
  }
  return { facts, ignored: without(reading.ignored, taken), warnings };
}

export function suggestionsFor(
  reading: TextReading,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
  numbering: Numbering,
  text: string,
): { readonly suggestions: readonly string[]; readonly ignored: readonly string[] } {
  const suggestions: string[] = [];
  const explained = new Set<string>();
  const index = hitIndex(dictionary);
  const hasPrint = kept.print !== undefined || reading.conflicts.some((conflict) => conflict.key === 'print');

  for (const word of reading.ignored) {
    const lower = word.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (lower.length < 3 && CAPACITY_WORDS[lower] === undefined && lower !== 'um' && lower !== 'pe') continue;
    const line = lineFor(word, lower, text, kept, dictionary, numbering, index, hasPrint);
    if (line === undefined) continue;
    suggestions.push(line);
    explained.add(word);
  }

  return { suggestions, ignored: reading.ignored.filter((word) => !explained.has(word)) };
}

/**
 * "Cups w/ lids" names the cup, and the lids come with it. A product type
 * introduced by with, w/ or c/w is that included item, so the other product
 * type is kept. Two products with no such word stay a conflict.
 */
export function productIncludedWith(
  text: string,
  reading: TextReading,
  dictionary: Dictionary,
  numbering: Numbering,
): { readonly code: string; readonly note: string; readonly drop: readonly string[] } | undefined {
  const conflict = reading.conflicts.find((entry) => entry.key === 'productType');
  if (conflict === undefined || conflict.found.length < 2) return undefined;

  const mentions: { readonly words: string; readonly code: string; readonly included: boolean }[] = [];
  for (const words of conflict.found) {
    const code = productCodeOf(words, dictionary);
    const places = mentionPlaces(text, words);
    if (code === undefined || places.length === 0) return undefined;
    for (const included of places) mentions.push({ words, code, included });
  }

  const heads = mentions.filter((mention) => !mention.included);
  const headCodes = [...new Set(heads.map((mention) => mention.code))];
  const headCode = headCodes[0];
  if (headCode === undefined || headCodes.length !== 1) return undefined;
  const extras = mentions.filter((mention) => mention.included && mention.code !== headCode);
  const extraWords = [...new Set(extras.map((mention) => mention.words))];
  if (extraWords.length === 0) return undefined;

  const headWords = heads.find((mention) => mention.code === headCode)?.words ?? headCode;
  const described = extraWords.map((words) => {
    const code = productCodeOf(words, dictionary) ?? words;
    return `${words} is ${productLabel(code, dictionary, numbering)}`;
  });
  const lead = described.join('. ');
  const note = described.length === 1
    ? `${lead}, included with ${headWords}, so the product is ${productLabel(headCode, dictionary, numbering)}.`
    : `${lead}. Included with ${headWords}, so the product is ${productLabel(headCode, dictionary, numbering)}.`;
  return {
    code: headCode,
    note,
    drop: extras.flatMap((mention) => markerWord(text, mention.words)),
  };
}

const INCLUDED_BEFORE = /(?:^|[^a-z0-9])(?:c\/w|w\/|with|\+)\s*$/i;

function productCodeOf(words: string, dictionary: Dictionary): string | undefined {
  const listed = WORD_LIST[words.toLowerCase()];
  if (listed !== undefined && 'productType' in listed) return listed.productType;
  return dictionary.valuesOf('productType').find((value) => value.meaning.toLowerCase() === words.toLowerCase())?.code;
}

function productLabel(code: string, dictionary: Dictionary, numbering: Numbering): string {
  const meaning = dictionary.meaningOf('productType', code) ?? code;
  const number = numbering.numberOf('productType', code);
  return number === undefined ? meaning : `${meaning} (A${number})`;
}

function mentionPlaces(text: string, words: string): boolean[] {
  const pattern = new RegExp(`(?<![a-z0-9])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'gi');
  const places: boolean[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    places.push(INCLUDED_BEFORE.test(text.slice(0, match.index)));
  }
  return places;
}

function markerWord(text: string, words: string): string[] {
  const pattern = new RegExp(`(?<![a-z0-9])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'gi');
  const dropped: string[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const marker = /(?:^|[^a-z0-9])(c\/w|w\/|\+)\s*$/i.exec(text.slice(0, match.index));
    const token = marker?.[1]?.toLowerCase();
    if (token === 'w/') dropped.push('w');
    else if (token === 'c/w') dropped.push('c/w');
  }
  return dropped;
}

/** A conflict whose sides each name dictionary entries. A print range stays as it was read. */
export function conflictLine(
  key: SlotKey,
  found: readonly string[],
  dictionary: Dictionary,
  numbering: Numbering,
): string {
  const name = slotDefinition(key).name;
  const index = hitIndex(dictionary);
  const sides = found.map((words) => side(words, index, numbering));
  if (sides.every((entry) => entry !== undefined)) {
    const tail = found.length === 2 ? 'Both were left out.' : 'All were left out.';
    return `${name}: ${sides.join('. ')}. ${tail}`;
  }
  return `${name} was given as ${found.join(' and ')}, so it was left out.`;
}

function lineFor(
  word: string,
  lower: string,
  text: string,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
  numbering: Numbering,
  index: Map<string, Hit[]>,
  hasPrint: boolean,
): string | undefined {
  if (lower === 'pe') return peLine(word, kept, dictionary, numbering);
  if (PRINT_WORDS.has(lower) || COLOURS_WORDS.has(lower)) return namedLine(word, 'print', kept, dictionary, numbering, hasPrint);
  if (COLOUR_WORDS.has(lower)) return colourLine(word, kept, dictionary, numbering, hasPrint);
  const count = COUNT_WORDS[lower];
  if (count !== undefined) return countLine(word, count, numberBeside(text, word), kept, dictionary);
  const measure = MEASURE_WORDS[lower];
  if (measure !== undefined) return measureLine(word, measure, numberBeside(text, word), kept, dictionary);
  if (lower === 'diameter' || lower === 'diameters') return diameterLine(word, numberBeside(text, word), kept, dictionary);
  if (lower === 'weight' || lower === 'weights' || lower === 'gram' || lower === 'grams') {
    return weightLine(word, numberBeside(text, word), kept, dictionary, lower === 'gram' || lower === 'grams');
  }
  const capacity = CAPACITY_WORDS[lower];
  if (capacity !== undefined) return capacityLine(word, capacity, numberBeside(text, word), kept, dictionary);
  const named = NAMED_WORDS[lower];
  if (named !== undefined) return namedLine(word, named, kept, dictionary, numbering, false);
  return matchLine(word, lower, kept, numbering, index);
}

function namedLine(
  word: string,
  slot: DictionarySlotKey,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
  numbering: Numbering,
  hasPrint: boolean,
): string | undefined {
  if (slot === 'print' && hasPrint) return undefined;
  if (already(slot, kept)) return undefined;
  const blocked = block(slot, word, kept, dictionary);
  if (blocked !== undefined) return blocked;
  const list = issued(slot, dictionary, numbering)
    .map((value) => `${value.meaning} is ${written(value, numbering)}`)
    .join('. ');
  return `${word} is mentioned, but not which one. ${list}.`;
}

function colourLine(
  word: string,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
  numbering: Numbering,
  hasPrint: boolean,
): string | undefined {
  const parts: string[] = [];
  if (!already('colourClarity', kept)) {
    const blocked = block('colourClarity', 'Colour', kept, dictionary);
    const colours = issued('colourClarity', dictionary, numbering)
      .map((value) => `${value.meaning} is ${written(value, numbering)}`)
      .join('. ');
    parts.push(blocked ?? `Item colours: ${colours}.`);
  }
  if (!hasPrint && !already('print', kept)) {
    const blocked = block('print', 'Print', kept, dictionary);
    const prints = issued('print', dictionary, numbering)
      .map((value) => `${value.meaning} is ${written(value, numbering)}`)
      .join('. ');
    parts.push(blocked ?? `Print: ${prints}.`);
  }
  if (parts.length === 0) return undefined;
  return `${word} could be the item colour, or a print. ${parts.join(' ')}`;
}

function countLine(
  word: string,
  slot: CountSlotKey,
  amount: string | undefined,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
): string | undefined {
  if (already(slot, kept)) return undefined;
  const blocked = block(slot, word, kept, dictionary);
  if (blocked !== undefined) return blocked;
  const letter = letterOf(slot);
  const definition = COUNTS[slot];
  if (amount === undefined) {
    const sample = slot === 'plies' ? '2' : '3';
    return `${word} is mentioned, but no count, from 1 to ${definition.max}. ${sample} ${definition.many} is ${letter}${sample}.`;
  }
  const count = Number(amount);
  if (!Number.isInteger(count) || count < 1 || count > definition.max) {
    return `${word} is mentioned as ${amount}, which is outside 1 to ${definition.max}.`;
  }
  const noun = count === 1 ? definition.one : definition.many;
  return `${word} is mentioned as ${amount}. ${amount} ${noun} is ${letter}${amount}.`;
}

function measureLine(
  word: string,
  slot: MeasureSlotKey,
  amount: string | undefined,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
): string | undefined {
  if (already(slot, kept)) return undefined;
  const blocked = block(slot, word, kept, dictionary);
  if (blocked !== undefined) return blocked;
  return `${word} is mentioned, but ${measureGap(slot, amount ?? sampleOf(slot), letterOf(slot))}.`;
}

function diameterLine(
  word: string,
  amount: string | undefined,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
): string | undefined {
  const slots = ['topDiameter', 'bottomDiameter'] as const;
  const open = slots.filter((slot) => !already(slot, kept));
  if (open.length === 0) return undefined;
  const notes = [...new Set(open.map((slot) => block(slot, slotDefinition(slot).name, kept, dictionary) ?? openDiameter(slot, amount)))];
  return `${word} is mentioned. ${notes.join(' ')}`;
}

function openDiameter(slot: 'topDiameter' | 'bottomDiameter', amount: string | undefined): string {
  const where = slot === 'topDiameter' ? 'on top' : 'on the bottom';
  const value = amount ?? SAMPLE_MM;
  return `${value} mm ${where} is ${letterOf(slot)}${value}.`;
}

function weightLine(
  word: string,
  amount: string | undefined,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
  includeCapacity: boolean,
): string | undefined {
  const parts: string[] = [];
  if (!already('unitWeight', kept)) {
    const blocked = block('unitWeight', 'Unit weight', kept, dictionary);
    parts.push(blocked ?? `Unit weight: ${measureGap('unitWeight', amount ?? SAMPLE_GRAMS, letterOf('unitWeight'))}.`);
  }
  if (!already('basisWeight', kept)) {
    const blocked = block('basisWeight', 'Basis weight', kept, dictionary);
    parts.push(blocked ?? `Basis weight: ${measureGap('basisWeight', amount ?? SAMPLE_GSM, letterOf('basisWeight'))}.`);
  }
  if (includeCapacity && !already('capacity', kept)) {
    const blocked = block('capacity', 'Capacity in grams', kept, dictionary);
    const value = amount ?? SAMPLE_OZ;
    parts.push(blocked ?? `Capacity in grams: ${value} g is G${V2_CAPACITY_DIGIT_BY_UNIT.G}${value}.`);
  }
  if (parts.length === 0) return undefined;
  return `${word} is mentioned, but not which weight. ${parts.join(' ')}`;
}

function capacityLine(
  word: string,
  unit: string | 'all',
  amount: string | undefined,
  kept: Partial<SpecIdFactsInput>,
  dictionary: Dictionary,
): string | undefined {
  if (already('capacity', kept)) return undefined;
  const blocked = block('capacity', word, kept, dictionary);
  if (blocked !== undefined) return blocked;
  const units = unit === 'all' ? ['Z', 'M', 'S', 'N', 'G'] : [unit];
  const value = amount ?? SAMPLE_OZ;
  const examples = units.map((entry) => capacityExample(entry, value)).join('. ');
  const asking = amount === undefined ? 'no amount' : `an amount of ${amount}, but not stored as a capacity`;
  return `${word} is mentioned, but ${asking}. ${examples}.`;
}

function peLine(word: string, kept: Partial<SpecIdFactsInput>, dictionary: Dictionary, numbering: Numbering): string | undefined {
  if (already('coating', kept)) return undefined;
  const blocked = block('coating', word, kept, dictionary);
  if (blocked !== undefined) return blocked;
  const list = issued('coating', dictionary, numbering)
    .filter((value) => tokens(value.meaning.toLowerCase()).includes('pe'))
    .map((value) => `${value.meaning} is ${written(value, numbering)}`)
    .join('. ');
  return `${word} isn't a coating on its own. ${list}.`;
}

function measureGap(slot: MeasureSlotKey, amount: string, letter: string): string {
  if (slot === 'unitWeight') {
    const steps = tenths(amount);
    return `no weight in tenths of a gram. The range is ${MEASURES.unitWeight.rangeText}. ${amount} g is ${letter}${steps}`;
  }
  if (slot === 'basisWeight') {
    return `no weight in gsm. The range is ${MEASURES.basisWeight.rangeText}. ${amount} gsm is ${letter}${amount}`;
  }
  if (slot === 'thickness') {
    return `no thickness in micrometres. The range is ${MEASURES.thickness.rangeText}. ${amount} µm is ${letter}${amount}`;
  }
  const noun = slot === 'gusset' || slot === 'width' ? 'width' : slot === 'height' ? 'height' : slot === 'length' ? 'length' : 'diameter';
  return `no ${noun} in millimetres. The range is ${MEASURES[slot].rangeText}. ${amount} mm is ${letter}${amount}`;
}

function matchLine(
  word: string,
  lower: string,
  kept: Partial<SpecIdFactsInput>,
  numbering: Numbering,
  index: Map<string, Hit[]>,
): string | undefined {
  const exactPhrase = exact(lower, index);
  const found = exactPhrase ?? index.get(lower) ?? [];
  if (found.length > 0) {
    const fresh = found.filter((hit) => kept[hit.slot] !== hit.code);
    return nearMiss(word, sortHits(fresh, numbering), numbering, exactPhrase !== undefined);
  }
  return nearMiss(word, sortHits(closeHits(lower, index, kept), numbering), numbering, false);
}

function nearMiss(word: string, hits: readonly Hit[], numbering: Numbering, listedPhrase: boolean): string | undefined {
  const first = hits[0];
  if (first === undefined) return undefined;
  if (hits.length === 1) {
    const code = writtenHit(first, numbering);
    return listedPhrase ? `${word} is ${first.meaning}, ${code}.` : `${word} isn't listed on its own. It matches ${first.meaning}, ${code}.`;
  }
  const list = hits.map((hit) => `${hit.meaning} (${writtenHit(hit, numbering)})`).join('. ');
  return `${word} matches ${hits.length} entries: ${list}.`;
}

function side(words: string, index: Map<string, Hit[]>, numbering: Numbering): string | undefined {
  const lower = words.toLowerCase();
  const hits = sortHits(exact(lower, index) ?? index.get(lower) ?? [], numbering);
  const first = hits[0];
  if (first === undefined) return undefined;
  if (hits.length === 1) return `${words} is ${first.meaning} (${writtenHit(first, numbering)})`;
  const list = hits.map((hit) => `${hit.meaning} (${writtenHit(hit, numbering)})`).join(', ');
  return `${words} matches ${list}`;
}

function closeHits(word: string, index: Map<string, Hit[]>, kept: Partial<SpecIdFactsInput>): Hit[] {
  if (word.length < 3) return [];
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const prefixes: string[] = [];
  for (const token of index.keys()) {
    if (token === word || token.length < 4) continue;
    const prefix = token.startsWith(word) && token.length > word.length;
    if (prefix) prefixes.push(token);
    if (!prefix && (word.length < 4 || PLAIN_WORD.has(token) || damerau(word, token) !== 1)) continue;
    if (word.length === 3 && prefix) continue;
    addToken(token);
  }
  if (word.length === 3 && prefixes.length === 1) {
    const only = prefixes[0];
    if (only !== undefined) addToken(only);
  }
  return hits;

  function addToken(token: string): void {
    for (const hit of index.get(token) ?? []) {
      const key = `${hit.slot}:${hit.code}`;
      if (seen.has(key) || kept[hit.slot] === hit.code) continue;
      seen.add(key);
      hits.push(hit);
    }
  }
}

function block(slot: SlotKey, word: string, kept: Partial<SpecIdFactsInput>, dictionary: Dictionary): string | undefined {
  const fill = fillOf(slot, kept, dictionary);
  if (fill === 'open' || fill.fill === 'any') return undefined;
  const product = productName(kept, dictionary);
  const name = slot === 'topDiameter' || slot === 'bottomDiameter' || slot === 'unitWeight' || slot === 'basisWeight' || slot === 'capacity' ? word : slotDefinition(slot).name;
  if (fill.fill === 'does-not-apply') return `${name} does not apply to a ${product}.`;
  if (fill.dependsOn === 'shape') {
    const round = dictionary.ruleFor(kept.productType ?? '', slot as RuledSlotKey) === 'round_only';
    return round
      ? `${name} applies to a round ${product} only, and the shape is not known yet.`
      : `${name} applies when a ${product} is not round, and the shape is not known yet.`;
  }
  return `${name} applies to paper only, and the material is not known yet.`;
}

function fillOf(slot: SlotKey, kept: Partial<SpecIdFactsInput>, dictionary: Dictionary): ExpectedFill | 'open' {
  if (slot === 'productType' || slot === 'material' || slot === 'variant') return 'open';
  if (kept.productType === undefined) return 'open';
  const expected = expectedFill(dictionary, kept.productType, slot, kept.shape ?? undefined, kept.material ?? undefined);
  if (expected !== null) return expected;
  const rule = dictionary.ruleFor(kept.productType, slot);
  if ((rule === 'round_only' || rule === 'non_round_only') && kept.shape === undefined) return { fill: 'not-known', dependsOn: 'shape' };
  if (rule === 'paper_only' && kept.material === undefined) return { fill: 'not-known', dependsOn: 'material' };
  return 'open';
}

function productName(kept: Partial<SpecIdFactsInput>, dictionary: Dictionary): string {
  if (kept.productType === undefined) return 'this product';
  return (dictionary.meaningOf('productType', kept.productType) ?? 'this product').toLowerCase();
}

function already(slot: SlotKey, kept: Partial<SpecIdFactsInput>): boolean {
  return factIn(kept, slot) !== undefined && factIn(kept, slot) !== null;
}

function issued(slot: DictionarySlotKey, dictionary: Dictionary, numbering: Numbering): DictionaryValue[] {
  return dictionary
    .valuesOf(slot)
    .filter((value) => numbering.numberOf(slot, value.code) !== undefined)
    .sort((left, right) => (numbering.numberOf(slot, left.code) ?? 0) - (numbering.numberOf(slot, right.code) ?? 0));
}

function written(value: DictionaryValue, numbering: Numbering): string {
  return `${letterOf(value.slot)}${numbering.numberOf(value.slot, value.code) ?? ''}`;
}

function writtenHit(hit: Hit, numbering: Numbering): string {
  return `${letterOf(hit.slot)}${numbering.numberOf(hit.slot, hit.code) ?? ''}`;
}

function letterOf(slot: SlotKey): string {
  return V2_LETTERS.find((entry) => entry.slot === slot)?.letter ?? '';
}

function sampleOf(slot: MeasureSlotKey): string {
  if (slot === 'unitWeight') return SAMPLE_GRAMS;
  if (slot === 'basisWeight') return SAMPLE_GSM;
  if (slot === 'thickness') return SAMPLE_UM;
  return SAMPLE_MM;
}

function capacityExample(unit: string, amount: string): string {
  const label = CAPACITY_UNIT_LABELS[unit] ?? unit;
  const digit = V2_CAPACITY_DIGIT_BY_UNIT[unit] ?? '';
  return `${amount} ${label} is G${digit}${amount}`;
}

function tenths(amount: string): string {
  const [whole = '0', fraction = ''] = amount.split('.');
  const tenth = (fraction + '0')[0] ?? '0';
  return `${whole}${tenth}`.replace(/^0+(\d)/, '$1');
}

function numberBeside(text: string, word: string): string | undefined {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:(\\d+(?:\\.\\d+)?)\\s*(?:mm|cm|in|gsm|um|µm|g|oz|ml)?\\s*${safe})|(?:${safe}\\s*(?:of\\s+)?(\\d+(?:\\.\\d+)?))`, 'i').exec(text);
  return match?.[1] ?? match?.[2];
}

function exact(word: string, index: Map<string, Hit[]>): Hit[] | undefined {
  const phrase = WORD_LIST[word];
  if (phrase === undefined) return undefined;
  const code = 'material' in phrase ? phrase.material : phrase.productType;
  const slot = 'material' in phrase ? 'material' : 'productType';
  const found = (index.get(word) ?? []).find((hit) => hit.slot === slot && hit.code === code);
  return found === undefined ? [] : [found];
}

function align(text: string, ignored: readonly string[]): { readonly kind: 'ignored' | 'stop' | 'used'; readonly token: string; readonly ignoredIndex: number }[] {
  const pending = ignored.map((word) => word.toLowerCase());
  let cursor = 0;
  return tokens(text.toLowerCase()).map((token) => {
    if (STOP_WORDS.has(token)) {
      if (pending[cursor] === token) cursor += 1;
      return { kind: 'stop' as const, token, ignoredIndex: -1 };
    }
    if (pending[cursor] === token) {
      const ignoredIndex = cursor;
      cursor += 1;
      return { kind: 'ignored' as const, token, ignoredIndex };
    }
    return { kind: 'used' as const, token, ignoredIndex: -1 };
  });
}

function commonHits(words: readonly string[], index: Map<string, Hit[]>): Hit[] {
  const first = words[0];
  if (first === undefined) return [];
  let hits = index.get(first) ?? [];
  for (const word of words.slice(1)) {
    const next = new Set((index.get(word) ?? []).map((hit) => `${hit.slot}:${hit.code}`));
    hits = hits.filter((hit) => next.has(`${hit.slot}:${hit.code}`));
  }
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.slot}:${hit.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meaningHas(hit: Hit, words: readonly string[]): boolean {
  const meaning = new Set(tokens(hit.meaning.toLowerCase()));
  return words.every((word) => meaning.has(word) || hit.code.toLowerCase() === word);
}

function settle(
  adopted: readonly { readonly hit: Hit; readonly phrase: string; readonly words: readonly string[] }[],
  consumed: ReadonlySet<number>,
  reading: TextReading,
  numbering: Numbering,
): { readonly facts: Partial<SpecIdFactsInput>; readonly ignored: readonly string[]; readonly warnings: readonly string[] } {
  const facts: Partial<SpecIdFactsInput> = {};
  const warnings: string[] = [];
  const bySlot = new Map<DictionarySlotKey, { readonly hit: Hit; readonly phrase: string; readonly words: readonly string[] }[]>();
  for (const item of adopted) {
    const list = bySlot.get(item.hit.slot) ?? [];
    list.push(item);
    bySlot.set(item.hit.slot, list);
  }
  for (const [slot, items] of bySlot) {
    const codes = [...new Set(items.map((item) => item.hit.code))];
    const existing = reading.facts[slot];
    const existingCode = typeof existing === 'string' ? existing : undefined;
    const hit = items[0]?.hit;
    if (hit === undefined) continue;
    const sameFact = existingCode !== undefined && codes.length === 1 && codes[0] === existingCode;
    const narrowerFact = existingCode !== undefined && codes.length === 1 && codes[0] !== existingCode && items.every((item) => factInside(reading, slot, item.words));
    if (!sameFact && (codes.length > 1 || (existingCode !== undefined && !narrowerFact))) {
      const sides = items.map((item) => `${item.phrase} is ${item.hit.meaning} (${writtenHit(item.hit, numbering)})`);
      warnings.push(`${slotDefinition(slot).name}: ${sides.join('. ')}. Both were left out.`);
      continue;
    }
    if (!sameFact) (facts as Record<string, string>)[slot] = hit.code;
  }
  return { facts, ignored: reading.ignored.filter((_, index) => !consumed.has(index)), warnings };
}

/** The earlier fact was read from words inside this name, so the name is the more specific entry. */
function factInside(reading: TextReading, slot: SlotKey, words: readonly string[]): boolean {
  const fact = reading.read.find((item) => item.key === slot);
  if (fact === undefined) return false;
  const span = new Set(words);
  const used = tokens(fact.words.toLowerCase());
  return used.length > 0 && used.every((word) => span.has(word));
}

function hitIndex(dictionary: Dictionary): Map<string, Hit[]> {
  const index = new Map<string, Hit[]>();
  const add = (token: string, hit: Hit) => {
    if (token.length === 0) return;
    const list = index.get(token) ?? [];
    if (list.some((entry) => entry.slot === hit.slot && entry.code === hit.code)) {
      index.set(token, list);
      return;
    }
    list.push(hit);
    index.set(token, list);
  };
  for (const [phrase, meaning] of Object.entries(WORD_LIST)) {
    const hit = hitFromPhrase(meaning, dictionary);
    if (hit === undefined) continue;
    for (const token of tokens(phrase)) add(token, hit);
  }
  for (const value of dictionary.values()) {
    if (value.slot === 'capacity') continue;
    const hit = { slot: value.slot, code: value.code, meaning: value.meaning };
    add(value.code.toLowerCase(), hit);
    for (const token of tokens(value.meaning.toLowerCase())) add(token, hit);
  }
  return index;
}

function hitFromPhrase(meaning: { readonly productType: string } | { readonly material: string }, dictionary: Dictionary): Hit | undefined {
  if ('material' in meaning) {
    const text = dictionary.meaningOf('material', meaning.material);
    return text === undefined ? undefined : { slot: 'material', code: meaning.material, meaning: text };
  }
  const text = dictionary.meaningOf('productType', meaning.productType);
  return text === undefined ? undefined : { slot: 'productType', code: meaning.productType, meaning: text };
}

function sortHits(hits: readonly Hit[], numbering: Numbering): Hit[] {
  return [...hits].sort((left, right) => {
    const slots = letterOf(left.slot).charCodeAt(0) - letterOf(right.slot).charCodeAt(0);
    if (slots !== 0) return slots;
    return (numbering.numberOf(left.slot, left.code) ?? 0) - (numbering.numberOf(right.slot, right.code) ?? 0);
  });
}

interface MeaningMatch {
  readonly slot: DictionarySlotKey;
  readonly code: string;
  readonly meaning: string;
  readonly start: number;
  readonly end: number;
  readonly span: string;
  readonly words: readonly string[];
}

type NamedFact =
  | { readonly kind: 'measure'; readonly slot: MeasureSlotKey; readonly value: string; readonly unit: string; readonly start: number; readonly end: number; readonly span: string }
  | { readonly kind: 'count'; readonly slot: CountSlotKey; readonly value: string; readonly start: number; readonly end: number; readonly span: string }
  | { readonly kind: 'capacity'; readonly unit: string; readonly value: string; readonly start: number; readonly end: number; readonly span: string };

const AMOUNT = '(\\d+(?:\\.\\d+)?)';
const WHOLE = '(\\d+)';
const WRITTEN_UNIT =
  '(millimetres?|millimeters?|centimetres?|centimeters?|inches|inch|kilograms?|grams?|gsm|µm|um|microns?|mm|cm|kg|in|g)';

function findNamedFacts(text: string): NamedFact[] {
  const found: NamedFact[] = [];
  for (const named of NAMED_MEASURES) {
    const before = new RegExp(`(?<![a-z0-9])${AMOUNT}\\s*${WRITTEN_UNIT}?\\s+(?:${named.name})(?![a-z])`, 'gi');
    const after = new RegExp(`(?<![a-z])(?:${named.name})\\s+(?:of\\s+)?${AMOUNT}\\s*${WRITTEN_UNIT}?(?![a-z0-9])`, 'gi');
    for (const match of text.matchAll(before)) addMeasure(found, named, match);
    for (const match of text.matchAll(after)) addMeasure(found, named, match);
  }
  for (const named of UNIT_MEASURES) {
    const expression = new RegExp(`(?<![a-z0-9])${AMOUNT}\\s*(?:${named.pattern})(?![a-z0-9])`, 'gi');
    for (const match of text.matchAll(expression)) {
      const value = match[1];
      if (value === undefined || match.index === undefined) continue;
      found.push({ kind: 'measure', slot: named.slot, value, unit: named.unit, start: match.index, end: match.index + match[0].length, span: match[0] });
    }
  }
  for (const named of NAMED_COUNTS) {
    const before = new RegExp(`(?<![a-z0-9])${WHOLE}\\s+(?:${named.name})(?![a-z])`, 'gi');
    const after = new RegExp(`(?<![a-z])(?:${named.name})\\s+(?:of\\s+)?${WHOLE}(?![a-z0-9])`, 'gi');
    for (const match of [...text.matchAll(before), ...text.matchAll(after)]) addCount(found, named.slot, match);
  }
  for (const named of NAMED_CAPACITIES) {
    const before = new RegExp(`(?<![a-z0-9])${WHOLE}\\s*(?:${named.name})(?![a-z0-9])`, 'gi');
    const after = new RegExp(`(?<![a-z])(?:${named.name})\\s+(?:of\\s+)?${WHOLE}(?![a-z0-9])`, 'gi');
    for (const match of [...text.matchAll(before), ...text.matchAll(after)]) addCapacity(found, named.unit, match);
  }
  return preferLonger(found);
}

function addMeasure(found: NamedFact[], named: { readonly slot: MeasureSlotKey; readonly unit: string }, match: RegExpMatchArray): void {
  const value = match[1];
  const unit = unitOf(named.slot, match[2], named.unit);
  if (value === undefined || unit === undefined || match.index === undefined) return;
  found.push({ kind: 'measure', slot: named.slot, value, unit, start: match.index, end: match.index + match[0].length, span: match[0] });
}

function addCount(found: NamedFact[], slot: CountSlotKey, match: RegExpMatchArray): void {
  const value = match[1];
  if (value === undefined || match.index === undefined) return;
  const count = Number(value);
  const definition = COUNTS[slot];
  if (!Number.isInteger(count) || count < 1 || count > definition.max) return;
  found.push({ kind: 'count', slot, value, start: match.index, end: match.index + match[0].length, span: match[0] });
}

function addCapacity(found: NamedFact[], unit: string, match: RegExpMatchArray): void {
  const value = match[1];
  if (value === undefined || match.index === undefined) return;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 1 || amount > 9999) return;
  found.push({ kind: 'capacity', unit, value, start: match.index, end: match.index + match[0].length, span: match[0] });
}

function preferLonger(found: readonly NamedFact[]): NamedFact[] {
  const sorted = [...found].sort((left, right) => right.end - right.start - (left.end - left.start) || left.start - right.start);
  const kept: NamedFact[] = [];
  for (const hit of sorted) {
    if (kept.some((other) => other.start < hit.end && hit.start < other.end)) continue;
    kept.push(hit);
  }
  return kept;
}

function keepNamed(
  slot: SlotKey,
  list: readonly NamedFact[],
  reading: TextReading,
  dictionary: Dictionary,
  facts: FactDraft,
  warnings: string[],
  taken: string[],
  write: (hit: NamedFact) => void,
): void {
  if (list.length === 0) return;
  const blocked = block(slot, slotDefinition(slot).name, { ...reading.facts, ...facts }, dictionary);
  if (blocked !== undefined) {
    if (!warnings.includes(blocked)) warnings.push(blocked);
    for (const hit of list) taken.push(...pieces(hit.span));
    return;
  }
  if (factIn(reading.facts, slot) !== undefined && factIn(reading.facts, slot) !== null) return;
  const distinct = new Set(list.map((hit) => (hit.kind === 'count' ? hit.value : `${hit.value} ${hit.unit}`)));
  if (distinct.size > 1) {
    const shown = list.map((hit) => (hit.kind === 'count' ? hit.value : `${hit.value} ${hit.kind === 'capacity' ? (CAPACITY_UNIT_LABELS[hit.unit] ?? hit.unit) : (UNIT_LABELS[hit.unit] ?? hit.unit)}`)).join(' and ');
    warnings.push(`${slotDefinition(slot).name} was given as ${shown}, so it was left out.`);
    for (const hit of list) taken.push(...pieces(hit.span));
    return;
  }
  const hit = list[0];
  if (hit === undefined) return;
  write(hit);
  for (const item of list) taken.push(...pieces(item.span));
}

function adoptLooseGrams(
  text: string,
  hits: readonly NamedFact[],
  reading: TextReading,
  dictionary: Dictionary,
  facts: FactDraft,
  warnings: string[],
  taken: string[],
): void {
  const expression = /(?<![a-z0-9])(?:(\d+(?:\.\d+)?)\s*(?:grams?|g)|grams?\s+(?:of\s+)?(\d+(?:\.\d+)?))(?![a-z0-9])/gi;
  const loose: NamedFact[] = [];
  for (const match of text.matchAll(expression)) {
    const value = match[1] ?? match[2];
    if (value === undefined || match.index === undefined) continue;
    const end = match.index + match[0].length;
    if (hits.some((hit) => hit.start < end && match.index !== undefined && match.index < hit.end)) continue;
    const decimal = value.includes('.');
    const weightOpen = openSlot('unitWeight', reading, facts, dictionary);
    const capacityOpen = !decimal && openSlot('capacity', reading, facts, dictionary);
    if (weightOpen === capacityOpen) continue;
    if (weightOpen) loose.push({ kind: 'measure', slot: 'unitWeight', value, unit: 'g', start: match.index, end, span: match[0] });
    else loose.push({ kind: 'capacity', unit: 'G', value, start: match.index, end, span: match[0] });
  }
  const weight = loose.filter((hit) => hit.kind === 'measure');
  const capacity = loose.filter((hit) => hit.kind === 'capacity');
  keepNamed('unitWeight', weight, reading, dictionary, facts, warnings, taken, (hit) => {
    if (hit.kind === 'measure') writeMeasure(facts, 'unitWeight', hit.value, hit.unit);
  });
  keepNamed('capacity', capacity, reading, dictionary, facts, warnings, taken, (hit) => {
    if (hit.kind === 'capacity') facts.capacity = { unit: hit.unit, value: hit.value };
  });
}

function openSlot(slot: SlotKey, reading: TextReading, facts: Partial<SpecIdFactsInput>, dictionary: Dictionary): boolean {
  if (factIn(reading.facts, slot) !== undefined && factIn(reading.facts, slot) !== null) return false;
  if (factIn(facts, slot) !== undefined && factIn(facts, slot) !== null) return false;
  return block(slot, slotDefinition(slot).name, { ...reading.facts, ...facts }, dictionary) === undefined;
}

function unitOf(slot: MeasureSlotKey, written: string | undefined, fallback: string): string | undefined {
  const unit = normalUnit(written) ?? fallback;
  if (slot === 'unitWeight') return unit === 'g' || unit === 'kg' ? unit : undefined;
  if (slot === 'basisWeight') return unit === 'gsm' ? unit : undefined;
  if (slot === 'thickness') return unit === 'um' || unit === 'mm' || unit === 'cm' || unit === 'in' ? unit : undefined;
  return unit === 'mm' || unit === 'cm' || unit === 'in' ? unit : undefined;
}

function normalUnit(written: string | undefined): string | undefined {
  if (written === undefined || written === '') return undefined;
  const unit = written.toLowerCase();
  if (unit === 'inch' || unit === 'inches') return 'in';
  if (unit === 'millimetre' || unit === 'millimetres' || unit === 'millimeter' || unit === 'millimeters') return 'mm';
  if (unit === 'centimetre' || unit === 'centimetres' || unit === 'centimeter' || unit === 'centimeters') return 'cm';
  if (unit === 'µm' || unit === 'micron' || unit === 'microns') return 'um';
  if (unit === 'gram' || unit === 'grams') return 'g';
  if (unit === 'kilogram' || unit === 'kilograms') return 'kg';
  return unit;
}

function writeMeasure(facts: FactDraft, slot: MeasureSlotKey, value: string, unit: string): void {
  const measurement = { value, unit };
  switch (slot) {
    case 'topDiameter':
      facts.topDiameter = measurement;
      return;
    case 'bottomDiameter':
      facts.bottomDiameter = measurement;
      return;
    case 'height':
      facts.height = measurement;
      return;
    case 'length':
      facts.length = measurement;
      return;
    case 'width':
      facts.width = measurement;
      return;
    case 'gusset':
      facts.gusset = measurement;
      return;
    case 'unitWeight':
      facts.unitWeight = measurement;
      return;
    case 'basisWeight':
      facts.basisWeight = measurement;
      return;
    case 'thickness':
      facts.thickness = measurement;
      return;
  }
}

function pieces(span: string): string[] {
  return span
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase())
    .filter((word) => word.length > 0);
}

function without(ignored: readonly string[], taken: readonly string[]): string[] {
  const pending = [...taken];
  return ignored.filter((word) => {
    const index = pending.indexOf(word.toLowerCase());
    if (index === -1) return true;
    pending.splice(index, 1);
    return false;
  });
}

function tokens(phrase: string): string[] {
  return phrase.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

/** A word that only sits inside a longer name. "size" is one letter from "side", and that is not the coating. */
const PLAIN_WORD = new Set([
  'and',
  'as',
  'both',
  'by',
  'coating',
  'for',
  'from',
  'grade',
  'inside',
  'known',
  'not',
  'of',
  'only',
  'outside',
  'paper',
  'paperboard',
  'side',
  'sides',
  'source',
  'stated',
  'the',
  'with',
]);

/** One transposition counts as one change, so HDEP still finds HDPE. */
function damerau(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > 1) return 2;
  const rows = left.length + 1;
  const columns = right.length + 1;
  const score: number[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, () => 0));
  for (let row = 0; row < rows; row += 1) {
    const line = score[row];
    if (line !== undefined) line[0] = row;
  }
  const first = score[0];
  if (first !== undefined) for (let column = 0; column < columns; column += 1) first[column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const line = score[row];
      const above = score[row - 1];
      if (line === undefined || above === undefined) continue;
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const deletion = (above[column] ?? 0) + 1;
      const insertion = (line[column - 1] ?? 0) + 1;
      const replacement = (above[column - 1] ?? 0) + cost;
      let best = Math.min(deletion, insertion, replacement);
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        const diagonal = score[row - 2]?.[column - 2] ?? 0;
        best = Math.min(best, diagonal + 1);
      }
      line[column] = best;
    }
  }
  return score[left.length]?.[right.length] ?? 2;
}
