import type { DecodedSpecId, SimilarCriteria } from './atlas';
import { knownCriteria } from './known-criteria';

/*
 * The same product in its other sizes: every saved Spec ID whose code has the
 * same facts, the part before the hyphen, with any sizes or none. The review
 * sheet's Spec IDs tab groups codes the same way (plan 0015).
 */

/** A code's facts, the part before the hyphen: `A1B1E1` of `A1B1E1-N170`. */
export function factsOf(code: string): string {
  const hyphen = code.indexOf('-');
  return hyphen === -1 ? code : code.slice(0, hyphen);
}

/** A code's sizes, the parts after the hyphen: `N170` of `A1B1E1-N170`. */
function sizePartsOf(code: string): Set<string> {
  const hyphen = code.indexOf('-');
  return new Set(hyphen === -1 ? [] : [...code.slice(hyphen + 1).matchAll(/[A-Z]\d+(?:\.\d+)?/g)].map(([part]) => part));
}

/** What the similar lookup asks for to find a code's facts at any size: its known slots, its sizes left out. */
export function factsCriteria(decoded: DecodedSpecId): SimilarCriteria {
  const sizes = sizePartsOf(decoded.code);
  const criteria = knownCriteria(decoded);
  for (const slot of decoded.slots) if (sizes.has(slot.part)) delete criteria[slot.key];
  return criteria;
}

/**
 * Two codes in the order a person reads them: part by part, each part's
 * letter, then its number as a number, so A3 comes before A10, and a code that
 * stops sooner comes first. The review sheet orders its codes the same way.
 */
export function compareCodes(a: string, b: string): number {
  const partsOf = (code: string) =>
    [...code.matchAll(/([A-Z])(\d+(?:\.\d+)?)/g)].map(([, letter = '', number = '0']) => ({ letter, number: Number(number) }));
  const [left, right] = [partsOf(a), partsOf(b)];
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const [x, y] = [left[index], right[index]];
    if (!x || !y) break;
    if (x.letter !== y.letter) return x.letter < y.letter ? -1 : 1;
    if (x.number !== y.number) return x.number - y.number;
  }
  return left.length - right.length;
}

/** Whether a saved Spec ID has exactly the facts of `code`: listed with its other sizes, so not again among those that fit. */
export function hasSameFacts(code: string, saved: { code: string }): boolean {
  return factsOf(saved.code) === factsOf(code);
}

/** Of `saved`, those with exactly the facts of `code`, in reading order. */
export function withSameFacts<T extends { code: string }>(code: string, saved: readonly T[]): T[] {
  const facts = factsOf(code);
  return saved.filter((item) => factsOf(item.code) === facts).sort((a, b) => compareCodes(a.code, b.code));
}
