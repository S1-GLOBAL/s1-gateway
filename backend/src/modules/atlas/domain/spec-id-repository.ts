import type { Result } from '../../../shared/domain/result.js';
import type { SavedSpecId } from './saved-spec-id.js';
import type { SimilarCriteria } from './similar-match.js';
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
}

/** A Spec ID that once had a code, and when it stopped having it. */
export interface FormerHolderRecord {
  record: SavedSpecIdRecord;
  until: Date;
}

/** Where a library page starts: after this Spec ID, in the library's order. */
export interface LibraryCursor {
  lastChangedAt: Date;
  id: string;
}

export interface LibraryQuery {
  /** Part of the name, matched ignoring case, with `%` and `_` meaning themselves. */
  q?: string;
  /** A product type code. */
  productType?: string;
  after?: LibraryCursor;
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
  /** At most `limit` Spec IDs, newest change first, then by id descending. */
  list(query: LibraryQuery): Promise<SavedSpecIdRecord[]>;
  /** Every history entry of one Spec ID, newest first. */
  history(id: string): Promise<SpecIdChangeRecord[]>;
  /** Each Spec ID that once had `code`, by its newest change away from it, newest first. */
  formerHolders(code: string): Promise<FormerHolderRecord[]>;
}
