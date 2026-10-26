import type { Result } from '../../../../shared/domain/result.js';
import type { SuggestionChangedError } from './suggestion.errors.js';
import type { Suggestion, SuggestionEvent, SuggestionStep } from './suggestion.js';

/** A suggestion with the names of the people in it, read from accounts. */
export interface SuggestionRecord {
  readonly suggestion: Suggestion;
  readonly suggestedByName: string;
  readonly decidedByName: string | null;
}

/** One step of a trail, with the name of who took it. */
export interface SuggestionEventRecord {
  readonly event: SuggestionEvent;
  readonly byName: string;
}

/** Waiting: the oldest first, so the longest wait is seen first. Decided: the latest decision first. */
export type SuggestionListFilter = 'waiting' | 'decided';

/** Where suggestions and their trails are kept (#95). Events are only ever added. */
export interface SuggestionRepository {
  /** Records a new suggestion and its `suggested` event together. */
  add(step: SuggestionStep): Promise<void>;
  /**
   * Saves `step.suggestion` over the stored one, and records `step.event`,
   * together. Fails with `SuggestionChangedError` when the stored one is no
   * longer `expectedVersion`, or no longer waits.
   */
  save(step: SuggestionStep, expectedVersion: number): Promise<Result<void, SuggestionChangedError>>;
  findById(id: string): Promise<SuggestionRecord | null>;
  list(filter: SuggestionListFilter): Promise<SuggestionRecord[]>;
  /** A suggestion's trail, the first step first. */
  events(suggestionId: string): Promise<SuggestionEventRecord[]>;
  /** How many suggestions wait that `accountId` did not make. */
  countWaitingNotSuggestedBy(accountId: string): Promise<number>;
}
