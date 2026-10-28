import type { Dictionary, DictionaryValue, SlotRuleEntry } from './dictionary.js';
import { RULED_SLOTS, type SlotRule } from './slots.js';

/**
 * A vessel sold with its own lid. Container with lid is already `CWL`.
 * The other three are issued after S2 0.1.0, so the earlier numbers stay put.
 */
export const COMBINED_PRODUCT_TYPES: readonly DictionaryValue[] = [
  { slot: 'productType', code: 'BWB', meaning: 'Bowl with Bowl Lid' },
  { slot: 'productType', code: 'CWC', meaning: 'Cup with Cup Lid' },
  { slot: 'productType', code: 'PWC', meaning: 'Portion cup with Portion cup lid' },
];

interface Pair {
  readonly base: string;
  readonly other: string;
  readonly combined: string;
  readonly pattern: RegExp;
}

const PAIRS: readonly Pair[] = [
  { base: 'PCP', other: 'PCL', combined: 'PWC', pattern: paired('portion\\s+cups?', 'portion\\s+cup') },
  { base: 'CUP', other: 'CLD', combined: 'CWC', pattern: paired('(?<!portion\\s)cups?', 'cup') },
  { base: 'BWL', other: 'BLD', combined: 'BWB', pattern: paired('bowls?', 'bowl') },
  { base: 'CTN', other: 'CTL', combined: 'CWL', pattern: paired('containers?', 'container') },
];

/** A slot applies when either the vessel or its lid has it. */
export function combinedProductRules(dictionary: Dictionary): SlotRuleEntry[] {
  return PAIRS.filter((pair) => pair.combined !== 'CWL').flatMap((pair) =>
    RULED_SLOTS.map((slot) => ({
      productType: pair.combined,
      slot,
      rule: widen(dictionary.ruleFor(pair.base, slot), dictionary.ruleFor(pair.other, slot)),
    })),
  );
}

export interface LidFit {
  /** The lid that product is. */
  readonly code: string;
  /** The vessel phrase, with a size in front when one was written. */
  readonly fits: string;
  /** The vessel words alone, without the size. */
  readonly vessel: string;
  /** Words the fit used, so they are not left over. */
  readonly drop: readonly string[];
}

/**
 * "Lid for a souffle cup" names the lid. The words after "for" are the cup it
 * fits. A souffle cup is a portion cup, so the lid is a portion cup lid.
 */
export function lidFits(text: string): LidFit | undefined {
  const directed = /(?<![a-z0-9])lids?(?![a-z0-9])[^a-z0-9]+for[^a-z0-9]+([\s\S]{0,48}?)(?<![a-z0-9])(souffl[eé]s?\s+cups?|portion\s+cups?|bowls?|containers?|(?<!portion\s)cups?)(?![a-z0-9])/i.exec(text);
  if (directed?.[2] !== undefined) return fit(directed[2], directed[1] ?? '', true);
  const named = /(?<![a-z0-9])(souffl[eé]s?\s+cups?)\s+lids?(?![a-z0-9])/i.exec(text);
  if (named?.[1] !== undefined && named.index !== undefined) {
    return fit(named[1], text.slice(Math.max(0, named.index - 16), named.index), false);
  }
  return undefined;
}

function fit(vessel: string, gap: string, directed: boolean): LidFit | undefined {
  const kind = vessel.toLowerCase();
  const code = kind.startsWith('souffl') || kind.startsWith('portion') ? 'PCL'
    : kind.startsWith('bowl') ? 'BLD'
    : kind.startsWith('container') ? 'CTL'
    : kind.startsWith('cup') ? 'CLD'
    : undefined;
  if (code === undefined) return undefined;
  const size = /(?<![a-z0-9])(\d+(?:\.\d+)?)\s*(oz|ml)\s*$/i.exec(gap);
  const amount = size?.[1];
  const unit = size?.[2]?.toLowerCase() === 'ml' ? 'mL' : size?.[2]?.toLowerCase();
  const fits = amount !== undefined && unit !== undefined ? `${amount} ${unit} ${vessel}` : vessel;
  const drop = directed ? ['for'] : [];
  for (const word of kind.split(/[^a-z0-9é]+/)) {
    if (word === 'souffle' || word === 'soufflé' || word === 'portion') drop.push(word);
  }
  return { code, fits, vessel, drop };
}

/**
 * The combined product when the text names a vessel and then its lid.
 * `base` is the product already read, when there is one.
 */
export function combinationFor(text: string, base: string | undefined): string | undefined {
  for (const pair of PAIRS) {
    if (base !== undefined && base !== pair.base && base !== pair.combined) continue;
    if (pair.pattern.test(text)) return pair.combined;
  }
  return undefined;
}

function paired(base: string, qualifier: string): RegExp {
  return new RegExp(
    `(?<![a-z0-9])${base}(?![a-z0-9])(?:[^a-z0-9]+[a-z0-9]+){0,8}?[^a-z0-9]+(?:and|&|with|w\\/|c\\/w|\\+)[^a-z0-9]+(?:${qualifier}\\s+)?lids?(?![\\s-]*opening)(?![a-z0-9])`,
    'i',
  );
}

function widen(left: SlotRule, right: SlotRule): SlotRule {
  if (left === right || right === 'never') return left;
  if (left === 'never') return right;
  if (left === 'applies' || right === 'applies') return 'applies';
  return left;
}
