import type { Result } from '../../../shared/domain/result.js';
import type { SavedSpecId } from './saved-spec-id.js';
import type { SimilarCriteria } from './similar-match.js';
import type { DictionarySlotKey } from './slots.js';
import type { SpecIdChange } from './spec-id-change.js';
import type { SpecIdChangedError, SpecIdExistsError } from './spec-id.errors.js';

/** A saved Spec ID with the names of who saved it and who last changed it. */
export interface SavedSpecIdRecord {
  savedSpecId: SavedSpecId;
  savedByName: string;
  /** Null until the first change. */
  updatedByName: string | null;
}

/** One history entry with the name of whoever made it. */
export interface SpecIdChangeRecord {
  change: SpecIdChange;
  changedByName: string;
  /** When an approved dictionary change made it: that change, who suggested it and who approved it (ADR 0031). */
  dictionaryChange?: DictionaryChangeRecord | null;
}

/** A dictionary change, by number, with the two people in it. */
export interface DictionaryChangeRecord {
  number: number;
  suggestedBy: { id: string; fullName: string };
  approvedBy: { id: string; fullName: string };
}

/** A Spec ID that once had a code, and when it stopped having it. */
export interface FormerHolderRecord {
  record: SavedSpecIdRecord;
  until: Date;
}

/** The part of a library query that chooses which Spec IDs match, before a page is cut. */
export interface LibraryFilter {
  /** Part of the name, matched ignoring case, with `%` and `_` meaning themselves. */
  q?: string;
  /** A product type code. */
  productType?: string;
}

export interface LibraryQuery extends LibraryFilter {
  /** Rows to skip. Omitted means the start of the list. */
  offset?: number;
  limit: number;
}

/**
 * Where saved Spec IDs are kept. It adds, changes and reads; nothing deletes
 * (ADR 0022). Every add and change writes its history entry in the same
 * transaction.
 */
export interface SpecIdRepository {
  /** Fails with `SpecIdExistsError` when the code is already saved, also against a simultaneous save. */
  add(saved: SavedSpecId, created: SpecIdChange): Promise<Result<void, SpecIdExistsError>>;
  /**
   * Saves `saved` over the row whose version is `expectedVersion`. Fails with
   * `SpecIdChangedError` when that is no longer the current version, and with
   * `SpecIdExistsError` when another saved Spec ID has the new code.
   */
  update(
    saved: SavedSpecId,
    change: SpecIdChange,
    expectedVersion: number,
  ): Promise<Result<void, SpecIdExistsError | SpecIdChangedError>>;
  findById(id: string): Promise<SavedSpecIdRecord | null>;
  findByCode(code: string): Promise<SavedSpecIdRecord | null>;
  /**
   * Every saved Spec ID where each chosen slot equals the value or is not known
   * (`Y`, or all `0` from an older API), newest first, then by code. With no
   * slot chosen, every one.
   */
  findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]>;
  /** How many Spec IDs match, ignoring the page. */
  count(filter: LibraryFilter): Promise<number>;
  /** At most `limit` Spec IDs, newest change first, then by id descending. */
  list(query: LibraryQuery): Promise<SavedSpecIdRecord[]>;
  /** Every history entry of one Spec ID, newest first. */
  history(id: string): Promise<SpecIdChangeRecord[]>;
  /** Each Spec ID that once had `code`, by its newest change away from it, newest first. */
  formerHolders(code: string): Promise<FormerHolderRecord[]>;
  /**
   * How many saved Spec IDs hold dictionary option `code` in `slot`: for
   * capacity, a value with that unit. A suggestion shows it (#95).
   */
  usageOf(slot: DictionarySlotKey, code: string): Promise<number>;
  /** Every saved Spec ID holding dictionary option `code` in `slot`, as `usageOf` counts them. */
  holding(slot: DictionarySlotKey, code: string): Promise<SavedSpecIdRecord[]>;
}
