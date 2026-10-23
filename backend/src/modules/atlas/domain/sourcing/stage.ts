import type { QuoteValues } from './quote.js';

/** The stages only an admin sets: the verified list has no such status (#57, ADR 0027). */
export const ADMIN_STAGES = ['sampling', 'in-production'] as const;
export type AdminStage = (typeof ADMIN_STAGES)[number];

/** A manufacturer's stage on a Spec ID, from the first contact to mass production. */
export type Stage = 'specifications-received' | 'quoted' | AdminStage;

/**
 * Whether a quote's value is a price. The verified list writes `N/A`, `-` and
 * `/` in some price cells; a price always has a digit.
 */
export function hasPrice(value: string | null): boolean {
  return value !== null && /\d/.test(value);
}

/**
 * A manufacturer's stage: the one an admin set, else `quoted` when any of its
 * quotes has a per-unit or per-case price, else `specifications-received`.
 * Clearing an admin's stage (`null`) hands it back to the quotes.
 */
export function stageOf(quotes: readonly QuoteValues[], set: AdminStage | null): Stage {
  if (set !== null) return set;
  return quotes.some((quote) => hasPrice(quote.fobPerUnit) || hasPrice(quote.fobPerCase)) ? 'quoted' : 'specifications-received';
}

/** One change an admin made to a manufacturer's stage on a Spec ID. Only ever recorded, never changed. */
export interface StageChange {
  readonly id: string;
  readonly specId: string;
  readonly manufacturerId: string;
  readonly stageBefore: AdminStage | null;
  /** Null is a cleared stage. */
  readonly stageAfter: AdminStage | null;
  readonly changedBy: string;
  readonly changedAt: Date;
}
