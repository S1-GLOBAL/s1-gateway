import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { SavedSpecId } from '../../domain/saved-spec-id.js';
import { classifyMatch, type SimilarCriteria } from '../../domain/similar-match.js';
import { SpecIdExistsError } from '../../domain/spec-id.errors.js';
import type { SavedSpecIdRecord, SpecIdRepository } from '../../domain/spec-id-repository.js';

/** The SpecIdRepository contract, in memory. A test double, never used in production. */
export class InMemorySpecIdRepository implements SpecIdRepository {
  private readonly saved = new Map<string, SavedSpecId>();
  private readonly saverNames = new Map<string, string>();

  /** Teaches the fake a saver's name, as the real repository reads it from accounts. */
  nameSaver(accountId: string, fullName: string): void {
    this.saverNames.set(accountId, fullName);
  }

  /** How many Spec IDs are held. */
  get size(): number {
    return this.saved.size;
  }

  async add(saved: SavedSpecId): Promise<Result<void, SpecIdExistsError>> {
    if (this.saved.has(saved.specId.code)) return err(new SpecIdExistsError());
    this.saved.set(saved.specId.code, saved);
    return ok(undefined);
  }

  async findByCode(code: string): Promise<SavedSpecIdRecord | null> {
    const saved = this.saved.get(code);
    return saved ? this.record(saved) : null;
  }

  async findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]> {
    return [...this.saved.values()]
      .filter((saved) => classifyMatch((key) => saved.specId.slot(key), criteria) !== 'excluded')
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime() || compare(a.specId.code, b.specId.code))
      .map((saved) => this.record(saved));
  }

  private record(savedSpecId: SavedSpecId): SavedSpecIdRecord {
    return { savedSpecId, savedByName: this.saverNames.get(savedSpecId.savedBy) ?? 'Unknown' };
  }
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
