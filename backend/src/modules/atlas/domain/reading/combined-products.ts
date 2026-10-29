/*
 * A vessel sold with its own lid is one product: bowl with bowl lid (`BWB`),
 * cup with cup lid (`CWC`), portion cup with portion cup lid (`PWC`), and
 * container with lid (`CWL`). Migration 0018 added the first three (ADR 0032).
 * A lid named by what it fits is the lid alone.
 */

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
 * A vessel a lid can fit, as a text names it. A souffle is a portion cup, a
 * soup cup a bowl; a tray or a box takes a container lid.
 */
const VESSEL = '(souffl[eé]s?(?:\\s+cups?)?|portion\\s+cups?|soup\\s+cups?|bowls?|containers?|trays?|box(?:es)?|(?<!portion\\s|soup\\s)cups?)';
/** "Lid", but not a hinged lid, which is a clamshell's own. */
const LID = '(?<![a-z0-9])(?<!hinged?[\\s-]+)lids?(?![a-z0-9])';
/** The words that join a lid to the product it comes with: "with", "w/", "+". */
const JOINER = '(?:(?<![a-z0-9])(?:and|with|w\\/|c\\/w)|&|\\+)';
/** Up to three words between a joiner and its lid: "with dome lid", "w/ printed lids", "with clear lid combo". */
const FEW_WORDS = '(?:[a-z0-9]+[^a-z0-9]+){0,3}?';
/** A joiner, then up to three words, at the end of the text before a product's words. */
const INCLUDED_BEFORE = /(?:^|[^a-z0-9])(c\/w|w\/|with|\+)\s*(?:[a-z0-9.%-]+\s+){0,3}$/i;

/**
 * Whether the product words that follow `before` come with another product:
 * "cups w/ lids", "straw with individual paper wrap", "cup with dome lid".
 */
export function isIncluded(before: string): boolean {
  return INCLUDED_BEFORE.test(before);
}

/** The joiner that makes the words after `before` included, as written: `w/`, `c/w`, `with`, `+`. */
export function joinerBefore(before: string): string | undefined {
  return INCLUDED_BEFORE.exec(before)?.[1]?.toLowerCase();
}

interface Pair {
  readonly base: string;
  readonly other: string;
  readonly combined: string;
  readonly pattern: RegExp;
  /** The vessel's own word before "lid", as in "bowl lid". */
  readonly qualifier: string;
}

const PAIRS: readonly Pair[] = [
  { base: 'PCP', other: 'PCL', combined: 'PWC', pattern: paired('portion\\s+cups?', 'portion\\s+cup'), qualifier: 'portion\\s+cup' },
  { base: 'CUP', other: 'CLD', combined: 'CWC', pattern: paired('(?<!portion\\s)cups?', 'cup'), qualifier: 'cup' },
  { base: 'BWL', other: 'BLD', combined: 'BWB', pattern: paired('bowls?', 'bowl'), qualifier: 'bowl' },
  { base: 'CTN', other: 'CTL', combined: 'CWL', pattern: paired('containers?', 'container'), qualifier: 'container' },
];

const DIRECTED = new RegExp(`${LID}[^a-z0-9]+(for|fits?(?:\\s+for)?|to\\s+fit)[^a-z0-9]+([\\s\\S]{0,48}?)(?<![a-z0-9])${VESSEL}(?![a-z0-9])`, 'i');
/** "Cup Lids", "Bowl PET Lid", "Tray - Lid": the vessel, a few words, then the lid. */
const VESSEL_THEN_LID = new RegExp(`(?<![a-z0-9])${VESSEL}(?:[^a-z0-9]+[a-z0-9]+){0,3}?[^a-z0-9]+${LID}(?![\\s-]*opening)`, 'i');
/** "Lid 32 oz Paper Bowl", "Lid souffle 2oz": the lid, a few words, then the vessel. */
const LID_THEN_VESSEL = new RegExp(`${LID}([\\s\\S]{0,32}?)(?<![a-z0-9])${VESSEL}(?![a-z0-9])`, 'i');
/** A lid sold with its product: "+ lid", "with lid", "w/ printed lids". */
const JOINED_LID = new RegExp(`${JOINER}[^a-z0-9]*${FEW_WORDS}${LID}(?![\\s-]*opening)`, 'gi');

/**
 * The lid a text names by the vessel it fits. "Lid for a souffle cup", "lid
 * fit for a deli cup": the words after "for" are the vessel. "Cup lids",
 * "bowl PET lids", "lid 32 oz paper bowl": a lid and one vessel with no "with",
 * "and" or "+" between, so the lid is the product. A souffle cup is a portion
 * cup, so its lid is a portion cup lid; a tray's or a box's lid is a container
 * lid. A lid sold with its vessel is not one.
 */
export function lidFits(text: string): LidFit | undefined {
  const directed = DIRECTED.exec(text);
  if (directed?.[3] !== undefined) return fit(directed[3], directed[2] ?? '', (directed[1] ?? '').toLowerCase().split(/\s+/));
  if (joinedLids(text).length > 0 || combinationFor(text, undefined) !== undefined) return undefined;
  const after = VESSEL_THEN_LID.exec(text);
  if (after?.[1] !== undefined) return fit(after[1], text.slice(Math.max(0, after.index - 16), after.index + after[0].length), []);
  const before = LID_THEN_VESSEL.exec(text);
  if (before?.[2] !== undefined) return fit(before[2], before[1] ?? '', []);
  return undefined;
}

function fit(vessel: string, gap: string, joiner: readonly string[]): LidFit | undefined {
  const kind = vessel.toLowerCase();
  const code = kind.startsWith('souffl') || kind.startsWith('portion') ? 'PCL'
    : kind.startsWith('bowl') || kind.startsWith('soup') ? 'BLD'
    : kind.startsWith('container') || kind.startsWith('tray') || kind.startsWith('box') ? 'CTL'
    : kind.startsWith('cup') ? 'CLD'
    : undefined;
  if (code === undefined) return undefined;
  // The vessel's size, the last one written near it: "2oz Cup", "32 oz Paper Bowl".
  const size = [...gap.matchAll(/(?<![a-z0-9])(\d+(?:\.\d+)?)\s*(oz|ml)(?![a-z0-9])/gi)].at(-1);
  const amount = size?.[1];
  const unit = size?.[2]?.toLowerCase() === 'ml' ? 'mL' : size?.[2]?.toLowerCase();
  // One vessel, as the note names it: "Cups" is "Cup", "Boxes" is "Box".
  const one = vessel.replace(/(?<=x)es(?=\s|$)|s(?=\s|$)/gi, '');
  const fits = amount !== undefined && unit !== undefined ? `${amount} ${unit} ${one}` : one;
  const drop = joiner.filter((word) => word !== '');
  for (const word of kind.split(/[^a-z0-9é]+/)) {
    if (word === 'souffle' || word === 'soufflé' || word === 'portion') drop.push(word);
  }
  return { code, fits, vessel, drop };
}

/**
 * The combined product when the text names a vessel and its lid joined to
 * it. `base` is the product already read, when there is one: then a lid joined
 * anywhere in the text is its own ("invented pack + lid … container"), unless the
 * lid names another vessel.
 */
export function combinationFor(text: string, base: string | undefined): string | undefined {
  for (const pair of PAIRS) {
    if (base !== undefined && base !== pair.base && base !== pair.combined) continue;
    if (pair.pattern.test(text)) return pair.combined;
    if (base === pair.base && joinedLids(text).some((joined) => ownLid(joined, pair))) return pair.combined;
  }
  return undefined;
}

/**
 * The vessel sold with its lid, when `values` are one vessel and one lid and
 * the text joins a lid to its product: "invented pack + lid", whose sizes name
 * "Container: … & Lid: …". Undefined otherwise.
 */
export function vesselWithLid(values: readonly string[], text: string): string | undefined {
  if (values.length !== 2 || joinedLids(text).length === 0) return undefined;
  const lids = new Set(['CLD', ...PAIRS.map((pair) => pair.other)]);
  const vessel = PAIRS.find((pair) => values.includes(pair.base));
  return vessel !== undefined && values.some((value) => lids.has(value)) ? vessel.combined : undefined;
}

/**
 * The words a vessel sold with its lid used to join them, as `ignored` holds
 * them: "w/" is left as "w". Empty unless `code` is such a product.
 */
export function joinerWords(text: string, code: unknown): string[] {
  if (!PAIRS.some((pair) => pair.combined === code)) return [];
  return joinedLids(text).flatMap((joined) => {
    const joiner = /^(c\/w|w\/)/i.exec(joined.trim())?.[1]?.toLowerCase();
    return joiner === 'w/' ? ['w'] : joiner === 'c/w' ? ['c/w'] : [];
  });
}

/** Each lid joined to a product, as written: "with dome lid", "+ lid". */
function joinedLids(text: string): string[] {
  return [...text.matchAll(JOINED_LID)].map((match) => match[0]);
}

/** A joined lid that names no vessel, or names this pair's own. */
function ownLid(joined: string, pair: Pair): boolean {
  const vessel = new RegExp(`(?<![a-z0-9])${VESSEL}(?![a-z0-9])`, 'i').exec(joined);
  return vessel === null || new RegExp(`^${pair.qualifier}`, 'i').test(vessel[1] ?? '');
}

function paired(base: string, qualifier: string): RegExp {
  return new RegExp(
    `(?<![a-z0-9])${base}(?![a-z0-9])(?:[^a-z0-9]+[a-z0-9]+){0,8}?[^a-z0-9]+${JOINER}[^a-z0-9]+${FEW_WORDS}(?:${qualifier}\\s+)?${LID}(?![\\s-]*opening)`,
    'i',
  );
}
