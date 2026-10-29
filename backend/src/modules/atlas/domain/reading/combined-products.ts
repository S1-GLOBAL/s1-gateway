/*
 * A vessel sold with its own lid is one product: bowl with bowl lid (`BWB`),
 * cup with cup lid (`CWC`), portion cup with portion cup lid (`PWC`), and
 * container with lid (`CWL`). Migration 0018 added the first three (ADR 0032).
 * A lid named by what it fits is the lid alone.
 */

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

/** A vessel a lid can fit, as a text names it. */
const VESSEL = '(souffl[eé]s?\\s+cups?|portion\\s+cups?|bowls?|containers?|(?<!portion\\s)cups?)';

const DIRECTED = new RegExp(
  `(?<![a-z0-9])lids?(?![a-z0-9])[^a-z0-9]+(for|fits?(?:\\s+for)?|to\\s+fit)[^a-z0-9]+([\\s\\S]{0,48}?)(?<![a-z0-9])${VESSEL}(?![a-z0-9])`,
  'i',
);
/** "Cup Lids", "Bowl PET Lid": the vessel, a few words, then the lid. */
const VESSEL_THEN_LID = new RegExp(`(?<![a-z0-9])${VESSEL}(?:[^a-z0-9]+[a-z0-9]+){0,3}?[^a-z0-9]+lids?(?![\\s-]*opening)(?![a-z0-9])`, 'i');
/** "Lid 32 oz Paper Bowl": the lid, a few words, then the vessel. */
const LID_THEN_VESSEL = new RegExp(`(?<![a-z0-9])lids?(?![a-z0-9])([\\s\\S]{0,32}?)(?<![a-z0-9])${VESSEL}(?![a-z0-9])`, 'i');
/** A lid sold with its vessel: "+ lid", "with lid". */
const JOINED_LID = /(?:(?<![a-z0-9])(?:and|with|w\/|c\/w)|&|\+)[^a-z0-9]*lids?(?![a-z0-9])/i;

/**
 * The lid a text names by the vessel it fits. "Lid for a souffle cup", "lid
 * fit for a deli cup": the words after "for" are the vessel. "Cup lids",
 * "bowl PET lids", "lid 32 oz paper bowl": a lid and one vessel with no "with",
 * "and" or "+" between, so the lid is the product. A souffle cup is a portion
 * cup, so its lid is a portion cup lid. A lid sold with its vessel is not one.
 */
export function lidFits(text: string): LidFit | undefined {
  const directed = DIRECTED.exec(text);
  if (directed?.[3] !== undefined) return fit(directed[3], directed[2] ?? '', (directed[1] ?? '').toLowerCase().split(/\s+/));
  if (JOINED_LID.test(text) || combinationFor(text, undefined) !== undefined) return undefined;
  const after = VESSEL_THEN_LID.exec(text);
  if (after?.[1] !== undefined) return fit(after[1], text.slice(Math.max(0, after.index - 16), after.index + after[0].length), []);
  const before = LID_THEN_VESSEL.exec(text);
  if (before?.[2] !== undefined) return fit(before[2], before[1] ?? '', []);
  return undefined;
}

function fit(vessel: string, gap: string, joiner: readonly string[]): LidFit | undefined {
  const kind = vessel.toLowerCase();
  const code = kind.startsWith('souffl') || kind.startsWith('portion') ? 'PCL'
    : kind.startsWith('bowl') ? 'BLD'
    : kind.startsWith('container') ? 'CTL'
    : kind.startsWith('cup') ? 'CLD'
    : undefined;
  if (code === undefined) return undefined;
  // The vessel's size, the last one written near it: "2oz Cup", "32 oz Paper Bowl".
  const size = [...gap.matchAll(/(?<![a-z0-9])(\d+(?:\.\d+)?)\s*(oz|ml)(?![a-z0-9])/gi)].at(-1);
  const amount = size?.[1];
  const unit = size?.[2]?.toLowerCase() === 'ml' ? 'mL' : size?.[2]?.toLowerCase();
  // One vessel, as the note names it: "Cups" is "Cup".
  const one = vessel.replace(/s(?=\s|$)/gi, '');
  const fits = amount !== undefined && unit !== undefined ? `${amount} ${unit} ${one}` : one;
  const drop = joiner.filter((word) => word !== '');
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
