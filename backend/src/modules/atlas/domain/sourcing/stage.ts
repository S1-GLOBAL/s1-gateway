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
 * The time a stage change is stored at. The newest change is the latest time,
 * so a clock that is not already later than the change this one replaces —
 * two saves in one millisecond, or the slower of two at once — is moved 1ms
 * on. The change just recorded is then the one a read returns.
 */
export function recordedAt(replacedAt: Date | null, clock: Date): Date {
  if (replacedAt !== null && clock.getTime() <= replacedAt.getTime()) return new Date(replacedAt.getTime() + 1);
  return clock;
}

/**
 * A manufacturer's stage: the one an admin set, else `quoted` when any of its
 * quotes has a per-unit or per-case price, else `specifications-received`.
 * Clearing an admin's stage (`null`) hands it back to the quotes.
 */
export function stageOf(quotes: readonly QuoteValues[], set: AdminStage | null): Stage {
  return stageOfPriced(
    quotes.some((quote) => hasPrice(quote.fobPerUnit) || hasPrice(quote.fobPerCase)),
    set,
  );
}

/** `stageOf` for a read that already knows whether any quote has a price. */
export function stageOfPriced(priced: boolean, set: AdminStage | null): Stage {
  if (set !== null) return set;
  return priced ? 'quoted' : 'specifications-received';
}

/** The stages in the order a manufacturer reaches them (#73). */
export const STAGE_ORDER: readonly Stage[] = ['specifications-received', 'quoted', 'sampling', 'in-production'];

/** How many of a Spec ID's manufacturers have reached each stage, at it or later (#73). */
export interface ManufacturerStageCounts {
  readonly specificationsReceived: number;
  readonly quoted: number;
  readonly sampling: number;
  readonly inProduction: number;
}

/**
 * How many of `stages` reached each stage: a manufacturer reaches its own
 * stage and every earlier one, so one In production and one Quoted give
 * 2, 2, 1, 1 (#73).
 */
export function reachedCounts(stages: readonly Stage[]): ManufacturerStageCounts {
  const reached = (stage: Stage) =>
    stages.filter((own) => STAGE_ORDER.indexOf(own) >= STAGE_ORDER.indexOf(stage)).length;
  return {
    specificationsReceived: reached('specifications-received'),
    quoted: reached('quoted'),
    sampling: reached('sampling'),
    inProduction: reached('in-production'),
  };
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
