import type { Manufacturer } from './manufacturer.js';
import type { Quote, QuoteValues } from './quote.js';
import type { AdminStage, StageChange } from './stage.js';

/** A quote to record, with the manufacturer it comes from. */
export interface QuoteToRecord {
  readonly id: string;
  readonly specId: string;
  readonly manufacturer: {
    /** Used only when no manufacturer has this name yet. */
    readonly id: string;
    readonly name: string;
    /** Null leaves a known country as it is. */
    readonly country: string | null;
  };
  readonly values: QuoteValues;
  readonly importedAt: Date;
}

export interface QuoteRecord {
  readonly quote: Quote;
  readonly manufacturer: Manufacturer;
}

/** A stage change with the full name of the admin who made it. */
export interface StageChangeRecord {
  readonly change: StageChange;
  readonly changedByName: string;
}

/** A stage an admin sets, or clears with `null`, on one manufacturer for one Spec ID. */
export interface StageChangeToRecord {
  readonly id: string;
  readonly specId: string;
  readonly manufacturerId: string;
  readonly stageAfter: AdminStage | null;
  readonly changedBy: string;
  readonly changedAt: Date;
}

/** Where manufacturers and their quotes are kept (ADR 0027). */
export interface SourcingRepository {
  /**
   * In one transaction: finds or adds each quote's manufacturer by name,
   * trimmed and ignoring case, updating its country when the quote gives one;
   * deletes every quote; records the given ones. Manufacturers are never
   * deleted.
   */
  replaceQuotes(quotes: readonly QuoteToRecord[]): Promise<void>;
  /** Every quote for one Spec ID, by manufacturer name, then item name. */
  quotesOf(specId: string): Promise<QuoteRecord[]>;
  /** Each manufacturer's newest stage change on one Spec ID, if an admin made one. */
  currentStages(specId: string): Promise<StageChangeRecord[]>;
  /**
   * In one transaction, with the manufacturer's row locked: records the change
   * with the stage it replaces as `stageBefore`, and answers it. Its time is
   * the clock, or 1ms later when that clock is not already after the change
   * it replaces, so a read returns this change. Answers null, recording
   * nothing, when the stage is already `stageAfter`. Changes are only ever added.
   */
  recordStageChange(change: StageChangeToRecord): Promise<StageChange | null>;
}
