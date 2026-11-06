import type { Result } from '../../../../shared/domain/result.js';
import type { QuoteSuggestionChangedError } from './quote-suggestion.errors.js';
import type { QuoteSuggestion, QuoteSuggestionEvent, QuoteSuggestionStep } from './quote-suggestion.js';

/** A quotation with what a reader needs beside it: who took part, the Spec ID it quotes, and its manufacturer's name. */
export interface QuoteSuggestionRecord {
  readonly suggestion: QuoteSuggestion;
  readonly suggestedByName: string;
  readonly decidedByName: string | null;
  readonly specName: string;
  readonly specCode: string;
  /** The chosen manufacturer's name and country, or the new one's as named. */
  readonly manufacturerName: string;
  readonly manufacturerCountry: string | null;
}

/** One step of a trail, with the name of who took it. */
export interface QuoteSuggestionEventRecord {
  readonly event: QuoteSuggestionEvent;
  readonly byName: string;
}

/** Waiting: the oldest first, so the longest wait is seen first. Decided: the latest decision first. */
export type QuoteSuggestionListFilter = 'waiting' | 'decided';

/** The quote an approval records: its id, and the new manufacturer's id when the quotation names one. */
export interface ApprovedQuote {
  readonly quoteId: string;
  /** Used only when the quotation names a new manufacturer, and none of that name exists by then. */
  readonly newManufacturerId: string;
  readonly at: Date;
}

/** Where quotations and their trails are kept (ADR 0035). Events are only ever added. */
export interface QuoteSuggestionRepository {
  /** Records a new quotation and its `suggested` event together. */
  add(step: QuoteSuggestionStep): Promise<void>;
  /**
   * Saves `step.suggestion` over the stored one, and records `step.event`,
   * together. Fails with `QuoteSuggestionChangedError` when the stored one is
   * no longer `expectedVersion`, or no longer waits.
   */
  save(step: QuoteSuggestionStep, expectedVersion: number): Promise<Result<void, QuoteSuggestionChangedError>>;
  /**
   * As `save`, for an approval, and in the same transaction: finds or adds a
   * new manufacturer by name, trimmed and ignoring case, as the import does,
   * and records the quote, remembering the quotation it came from.
   */
  approve(step: QuoteSuggestionStep, expectedVersion: number, quote: ApprovedQuote): Promise<Result<void, QuoteSuggestionChangedError>>;
  findById(id: string): Promise<QuoteSuggestionRecord | null>;
  /** All of them, or one Spec ID's. */
  list(filter: QuoteSuggestionListFilter, specId?: string): Promise<QuoteSuggestionRecord[]>;
  /** A quotation's trail, the first step first. */
  events(suggestionId: string): Promise<QuoteSuggestionEventRecord[]>;
  /** How many quotations wait that `accountId` did not add. */
  countWaitingNotSuggestedBy(accountId: string): Promise<number>;
}
