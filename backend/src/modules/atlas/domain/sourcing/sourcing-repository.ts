import type { Manufacturer } from './manufacturer.js';
import type { Quote, QuoteValues } from './quote.js';

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
}
