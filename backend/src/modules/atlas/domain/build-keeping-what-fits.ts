import type { Dictionary } from './dictionary.js';
import type { SlotKey } from './slots.js';
import { SpecId, type SpecIdFactsInput } from './spec-id.js';

/** A fact the build refused, and why. */
export interface DroppedFact {
  readonly key: SlotKey;
  readonly reasons: readonly string[];
}

export interface KeptBuild {
  /** The code the kept facts make; null with no product type, or one the dictionary refuses. */
  readonly specId: SpecId | null;
  /** The facts that made it, without the dropped ones. */
  readonly facts: Partial<SpecIdFactsInput>;
  readonly dropped: readonly DroppedFact[];
}

/**
 * Builds the code for facts read from text, dropping each fact the build
 * refuses (a value in a slot the product type does not have, a number out of
 * range) and building again, until it builds. The product type is never
 * dropped: without it there is no code.
 */
export function buildKeepingWhatFits(read: Partial<SpecIdFactsInput>, dictionary: Dictionary): KeptBuild {
  const facts: Record<string, unknown> = { ...read };
  const dropped: DroppedFact[] = [];
  if (typeof facts.productType !== 'string') return { specId: null, facts, dropped };
  for (;;) {
    const built = SpecId.build(facts as unknown as SpecIdFactsInput, dictionary);
    if (built.ok) return { specId: built.value, facts, dropped };
    const refused = (Object.keys(built.error.issues) as SlotKey[]).filter((key) => key !== 'productType' && key in facts);
    if (refused.length === 0) return { specId: null, facts, dropped };
    for (const key of refused) {
      delete facts[key];
      dropped.push({ key, reasons: built.error.issues[key] ?? [] });
    }
  }
}
