import type { Result } from '../../../shared/domain/result.js';
import type { SavedSpecId } from './saved-spec-id.js';
import type { SimilarCriteria } from './similar-match.js';
import type { SpecIdExistsError } from './spec-id.errors.js';

/** A saved Spec ID with the name of the person who saved it. */
export interface SavedSpecIdRecord {
  savedSpecId: SavedSpecId;
  savedByName: string;
}

/** Where saved Spec IDs are kept. It adds and reads; nothing updates or deletes (ADR 0021). */
export interface SpecIdRepository {
  /** Fails with `SpecIdExistsError` when the code is already saved, also against a simultaneous save. */
  add(saved: SavedSpecId): Promise<Result<void, SpecIdExistsError>>;
  findByCode(code: string): Promise<SavedSpecIdRecord | null>;
  /**
   * Every saved Spec ID where each chosen slot equals the value or is all `0`,
   * newest first, then by code. With no slot chosen, every one.
   */
  findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]>;
}
