import type { Dictionary } from '../dictionary.js';
import { CAPACITY_UNIT, MATERIAL, PRODUCT_TYPE, WRAP } from '../options.js';
import { DICTIONARY_SLOTS, PAPER_FAMILY, ROUND_SHAPE, RULED_SLOTS, SLOTS, type DictionarySlotKey, type SlotKey } from '../slots.js';
import type { CapacityInput, MeasurementInput, SpecIdFactsInput } from '../spec-id.js';
import { isIncluded, vesselWithLid } from './combined-products.js';
import { KEYWORDS } from './keywords.js';
import { readSize, type Ruling } from './size-rulings.js';
import { NOT_PRODUCTS, WORD_LIST } from './word-list.js';

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
  /** Slots the text gives two different values for, as written and as codes: each left out of `facts`. */
  readonly conflicts: readonly { readonly key: SlotKey; readonly found: readonly string[]; readonly values: readonly string[] }[];
  /** The fact that named the product type, when no words did: a handle is only ever on a bag. */
  readonly productTypeFrom?: SlotKey;
  /** A product type named only as coming with the product, which is not named: "w/ printed lids". */
  readonly addOn?: string;
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
  readonly held?: true;
  /** How a conflict reports this value, when not as the span's own words: one end of a range. */
  readonly words?: string;
}

/** A match that reads a value. */
type ReadMatch = Match & { readonly value: string };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/** A slot value an option names, as `dictionary` has it: null once its option is deleted (ADR 0031). */
function liveValue(key: SlotKey, value: string, dictionary: Dictionary): string | null {
  if (!(DICTIONARY_SLOTS as readonly SlotKey[]).includes(key)) return value;
  const slot = key as DictionarySlotKey;
  return (slot === 'capacity' ? dictionary.liveCapacity(value) : dictionary.live(slot, value)) ?? null;
}

interface Phrase {
  readonly pattern: RegExp;
  readonly key: SlotKey;
  readonly value: (match: RegExpExecArray) => string | null;
  /** Words that name no product, and are not left over either: "printing plate". */
  readonly held?: true;
}

/** A number before a unit's search word, as a capacity keyword reads one: `12`, `12.5`. */
const NUMBER = '(\\d+(?:\\.\\d+)?)';
const wholePhrase = (source: string) => new RegExp(`(?<![a-z0-9])${source}(?![a-z0-9])`, 'g');
/** A product is named one or many: "napkin" and "napkins", "box" and "boxes". */
const oneOrMany = (source: string) => wholePhrase(`${source}(?:e?s)?`);

/**
 * Every phrase of the word list, every product-type name, and every approved
 * search word (ADR 0026, ADR 0031), as patterns. A unit's search word is read
 * after a number, as `12 fluid ounces`.
 */
function phrases(dictionary: Dictionary): Phrase[] {
  const fixed = (value: string | null) => () => value;
  const found: Phrase[] = Object.entries(WORD_LIST).map(([phrase, meaning]) => {
    if ('productType' in meaning) {
      return { pattern: oneOrMany(escape(phrase)), key: 'productType', value: fixed(liveValue('productType', meaning.productType, dictionary)) };
    }
    return { pattern: wholePhrase(escape(phrase)), key: 'material', value: fixed(liveValue('material', meaning.material, dictionary)) };
  });
  for (const { code, meaning } of dictionary.valuesOf('productType')) {
    found.push({ pattern: oneOrMany(escape(meaning.toLowerCase())), key: 'productType', value: fixed(code) });
  }
  // Their words hold their place, so the product type inside them is not read.
  for (const phrase of NOT_PRODUCTS) found.push({ pattern: wholePhrase(escape(phrase)), key: 'productType', value: fixed(null), held: true });
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
  for (const { pattern, key, value, held } of phrases(dictionary)) {
    for (const match of lower.matchAll(pattern)) {
      found.push({ start: match.index, end: match.index + match[0].length, key, value: value(match), paperOnly: false, ...(held ? { held } : {}) });
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

/**
 * Of two product types whose words overlap, the one that ends later: the last
 * noun is the head, so "paper cup carrier" is a cup carrier, not a paper cup,
 * and "paper container lid" a container lid.
 */
function headLast<M extends Match>(matches: readonly M[]): M[] {
  return matches.filter(
    (match) =>
      match.key !== 'productType' ||
      !matches.some((other) => other.key === 'productType' && other.start > match.start && other.start < match.end && other.end > match.end),
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
 * the other facts, then #28's rulings for a size. A `productType` or
 * `material` given wins over any the text names.
 */
export function readText(text: string, dictionary: Dictionary, productType?: string, material?: string): TextReading {
  const lower = text.toLowerCase();
  // A deleted option's words still hold their place, so no shorter phrase inside them is read, but read as nothing.
  const outer = headLast(withoutInner(allMatches(lower, dictionary))).map((match) =>
    // "Latex free", "PFAS free": a material named as absent is not the material.
    match.key === 'material' && /^[\s-]*free(?![a-z])/.test(lower.slice(match.end)) ? { ...match, value: null, held: true as const } : match,
  );
  const held = outer.filter((match) => match.held === true).map(({ start, end }) => ({ start, end }));
  let matches = outer.filter((match): match is ReadMatch => match.value !== null);
  matches = wrapsAsFeature(matches, lower, dictionary, productType);

  const byKey = new Map<SlotKey, ReadMatch[]>();
  for (const match of matches) byKey.set(match.key, [...(byKey.get(match.key) ?? []), match]);

  const facts: Record<string, FactValue> = {};
  const conflicts: { key: SlotKey; found: string[]; values: string[] }[] = [];
  const decide = (key: SlotKey, found: readonly ReadMatch[]) => {
    const values = [...new Set(found.map((match) => match.value))];
    const grade = key === 'material' ? gradeOverFamily(values, dictionary) : undefined;
    const amount = key === 'capacity' ? oneAmount(values, dictionary) : undefined;
    const kind =
      key === 'productType'
        ? (kitOf(values, dictionary) ?? kindOverGeneric(values, dictionary) ?? soldWithLid(values, lower, dictionary))
        : undefined;
    if (values.length === 1) facts[key] = factOf(key, values[0] ?? '');
    else if (grade !== undefined) facts[key] = factOf(key, grade);
    else if (amount !== undefined) facts[key] = factOf(key, amount);
    else if (kind !== undefined) facts[key] = factOf(key, kind);
    else {
      const first = (value: string) => found.find((match) => match.value === value) as ReadMatch;
      conflicts.push({ key, found: values.map((value) => first(value).words ?? wordsOf(text, [first(value)])), values });
    }
  };
  const given = { productType, material };
  for (const key of ['productType', 'material'] as const) {
    const found = byKey.get(key);
    const value = given[key];
    if (value !== undefined) facts[key] = value;
    else if (found) decide(key, found);
  }
  // "W/ printed lids" with no product before it: the lids come with a product the text does not name.
  const products = byKey.get('productType') ?? [];
  let addOn: string | undefined;
  if (
    productType === undefined &&
    typeof facts.productType === 'string' &&
    products.length > 0 &&
    products.every((match) => isIncluded(lower.slice(0, match.start)))
  ) {
    addOn = facts.productType;
    delete facts.productType;
  }
  const madeOf = typeof facts.material === 'string' ? facts.material : undefined;
  if (productType === undefined && boxIsContainer(facts.productType, madeOf, byKey.get('productType') ?? [], lower, dictionary)) {
    facts.productType = dictionary.live('productType', PRODUCT_TYPE.container) ?? PRODUCT_TYPE.container;
  }

  // Kraft is brown only on paper, and not on white kraft: a colour read from "kraft" waits for such a material.
  const onPaper = madeOf !== undefined && dictionary.isGradeOf(madeOf, PAPER_FAMILY) && madeOf !== MATERIAL.whiteKraft;
  matches = matches.filter((match) => !match.paperOnly || onPaper);
  for (const [key, found] of byKey) {
    if (key === 'productType' || key === 'material') continue;
    const kept = found.filter((match) => matches.includes(match));
    if (kept.length > 0) decide(key, kept);
  }

  // No words name the product, but a fact only one product type has does: a handle, or plies.
  let productTypeFrom: SlotKey | undefined;
  if (facts.productType === undefined && addOn === undefined && !conflicts.some((conflict) => conflict.key === 'productType')) {
    for (const key of RULED_SLOTS) {
      if (facts[key] === undefined) continue;
      const only = dictionary.valuesOf('productType').filter(({ code }) => dictionary.ruleFor(code, key) !== 'never');
      if (only.length !== 1 || only[0] === undefined) continue;
      facts.productType = only[0].code;
      productTypeFrom = key;
      break;
    }
  }

  const rulings = new Map<SlotKey, Ruling>();
  let sizeSpan: { start: number; end: number } | undefined;
  const used = [...matches.map(({ start, end }) => ({ start, end })), ...held];
  const type = typeof facts.productType === 'string' ? facts.productType : undefined;
  if (type !== undefined) {
    let masked = lower;
    for (const { start, end } of used) masked = masked.slice(0, start) + ' '.repeat(end - start) + masked.slice(end);
    const size = readSize(masked, type, dictionary);
    const roundShape = dictionary.live('shape', ROUND_SHAPE);
    const round = size?.facts.shape === roundShape;
    if (size && !(round && facts.shape !== undefined && facts.shape !== roundShape)) {
      const start = masked.indexOf(size.words);
      sizeSpan = { start, end: start + size.words.length };
      used.push(sizeSpan);
      // The same size written again, before or after, is used too, so it is not left out.
      for (const repeat of size.repeats ?? []) {
        let at = masked.indexOf(repeat);
        while (at !== -1 && used.some((span) => span.start < at + repeat.length && at < span.end)) at = masked.indexOf(repeat, at + 1);
        if (at !== -1) used.push({ start: at, end: at + repeat.length });
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
    const from = key === 'productType' && productTypeFrom !== undefined ? productTypeFrom : key;
    const spans = ruling === null ? matches.filter((match) => match.key === from) : sizeSpan === undefined ? [] : [sizeSpan];
    return { key, words: wordsOf(text, spans), ruling };
  });

  const covered = (start: number, end: number) => used.some((span) => span.start < end && start < span.end);
  const ignored = [...text.matchAll(/\S+/g)]
    .filter((token) => !covered(token.index, token.index + token[0].length))
    .map((token) => token[0].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => word.length > 0);

  return {
    facts: facts as Partial<SpecIdFactsInput>,
    read,
    ignored,
    conflicts,
    ...(productTypeFrom === undefined ? {} : { productTypeFrom }),
    ...(addOn === undefined ? {} : { addOn }),
  };
}

/** The wrap a wrap's own words name: "paper wrap" is paper-wrapped. */
const WRAPS: Readonly<Record<string, string>> = { paper: WRAP.paperWrapped, plastic: WRAP.filmWrapped, film: WRAP.filmWrapped };

/**
 * A folding carton is paperboard, so a box named only "box", of plastic,
 * bagasse or foil, is a container.
 */
function boxIsContainer(
  read: unknown,
  material: string | undefined,
  products: readonly ReadMatch[],
  lower: string,
  dictionary: Dictionary,
): boolean {
  const box = dictionary.live('productType', PRODUCT_TYPE.foldingCarton);
  if (box === undefined || read !== box || material === undefined || dictionary.isGradeOf(material, PAPER_FAMILY)) return false;
  return products.every((match) => /^box(?:es)?$/.test(lower.slice(match.start, match.end)));
}

/**
 * "Straw with individual paper wrap", "fork (paper wrap)": beside a product
 * that is wrapped, a wrap is how it is wrapped, not a second product.
 */
function wrapsAsFeature(matches: ReadMatch[], lower: string, dictionary: Dictionary, productType: string | undefined): ReadMatch[] {
  const sheet = dictionary.live('productType', PRODUCT_TYPE.wrapOrSheet);
  if (sheet === undefined) return matches;
  const wrapped = (code: string) => code !== sheet && dictionary.ruleFor(code, 'wrap') !== 'never';
  const products = matches.filter((match) => match.key === 'productType');
  const product = productType ?? products.find((match) => wrapped(match.value))?.value;
  if (product === undefined || !wrapped(product)) return matches;
  const wraps = products.filter((match) => match.value === sheet);
  // "Paper" in "fork (paper wrap)" is the wrap's material, not the fork's.
  const inside = (match: ReadMatch) => wraps.some((wrap) => wrap.start <= match.start && match.end <= wrap.end);
  const kept = matches.filter((match) => !wraps.includes(match) && !(match.key === 'material' && inside(match)));
  for (const wrap of wraps) {
    const words = lower.slice(wrap.start, wrap.end);
    const named = Object.keys(WRAPS).find((word) => new RegExp(`(?<![a-z])${word}(?![a-z])`).test(words));
    const value = named === undefined ? null : liveValue('wrap', WRAPS[named] ?? '', dictionary);
    const said = kept.some((match) => match.key === 'wrap' && match.start < wrap.end && wrap.start < match.end);
    if (value !== null && !said) kept.push({ start: wrap.start, end: wrap.end, key: 'wrap', value, paperOnly: false });
  }
  return kept;
}

/** A vessel and a lid joined to it, as the dictionary names the two sold together now. */
function soldWithLid(values: readonly string[], lower: string, dictionary: Dictionary): string | undefined {
  const code = vesselWithLid(values, lower);
  return code === undefined ? undefined : dictionary.live('productType', code);
}

/** Cutlery, and what a cutlery kit holds besides. */
const CUTLERY = [PRODUCT_TYPE.fork, PRODUCT_TYPE.knife, PRODUCT_TYPE.spoon];
const IN_A_KIT = [...CUTLERY, PRODUCT_TYPE.napkin, PRODUCT_TYPE.straw, PRODUCT_TYPE.stirrer, PRODUCT_TYPE.cutleryKit];

/** "Knife + fork + napkin": two kinds of cutlery, and nothing a kit does not hold, are a cutlery kit. */
function kitOf(values: readonly string[], dictionary: Dictionary): string | undefined {
  const live = (codes: readonly string[]) => codes.map((code) => dictionary.live('productType', code));
  const kit = dictionary.live('productType', PRODUCT_TYPE.cutleryKit);
  const pieces = values.filter((value) => live(CUTLERY).includes(value));
  return kit !== undefined && pieces.length >= 2 && values.every((value) => live(IN_A_KIT).includes(value)) ? kit : undefined;
}

/**
 * Product types that are kinds of a more general one: a stand-up pouch is a bag, a souffle a cup, a clamshell a box and a
 * container, a bowl lid a lid, and a portion cup, a bowl or a tray a
 * container. Named beside its general word, the kind is the product.
 */
const P = PRODUCT_TYPE;
const KINDS: Readonly<Record<string, readonly string[]>> = {
  [P.bag]: [P.standUpPouch, P.sachet],
  [P.cup]: [P.portionCup],
  [P.foldingCarton]: [P.hingedContainer, P.fryCarton, P.takeoutBox, P.shippingBox],
  [P.container]: [P.hingedContainer, P.takeoutBox, P.pan, P.containerWithLid, P.portionCup, P.bowl, P.tray],
  [P.cupLid]: [P.bowlLid, P.portionCupLid, P.containerLid],
};

/**
 * The one product type among `values` that every other names more generally
 * ("corrugated box … small box" is a shipping box); undefined otherwise, so
 * two kinds ("cup" and "bowl") are still left out.
 */
export function kindOverGeneric(values: readonly string[], dictionary: Dictionary): string | undefined {
  const live = (code: string) => dictionary.live('productType', code);
  const kindsOf = (value: string) =>
    Object.entries(KINDS)
      .filter(([general]) => live(general) === value)
      .flatMap(([, kinds]) => kinds.map(live));
  const specific = values.filter((value) => values.every((other) => other === value || kindsOf(other).includes(value)));
  return specific.length === 1 ? specific[0] : undefined;
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
  const ounces = dictionary.live('capacity', CAPACITY_UNIT.ounces);
  const millilitres = dictionary.live('capacity', CAPACITY_UNIT.millilitres);
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
 * Paper, plastic and kraft of unknown grade: a text that names one beside one
 * grade of it means that grade. Paper and plastic only (plan 0011); kraft is a
 * paper.
 */
const FAMILIES: readonly string[] = [MATERIAL.polymer, MATERIAL.paper, MATERIAL.kraft];

/**
 * The one material among `values` that every other only names the family of
 * ("Paper" beside "White Kraft", "Plastic" beside "PET", "Kraft" beside
 * "Recycled kraft"); undefined otherwise, so two grades ("PET" and "PP") are
 * still left out.
 */
export function gradeOverFamily(values: readonly string[], dictionary: Dictionary): string | undefined {
  const covers = (family: string, value: string) =>
    FAMILIES.includes(family) && family !== value && dictionary.live('material', family) !== undefined && dictionary.isGradeOf(value, family);
  const specific = values.filter((value) => values.every((other) => other === value || covers(other, value)));
  return specific.length === 1 ? specific[0] : undefined;
}
