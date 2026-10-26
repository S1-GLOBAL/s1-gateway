import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { SavedSpecId } from '../../domain/saved-spec-id.js';
import { classifyMatch, type SimilarCriteria } from '../../domain/similar-match.js';
import type { SpecIdChange } from '../../domain/spec-id-change.js';
import { SpecIdChangedError, SpecIdExistsError } from '../../domain/spec-id.errors.js';
import type {
  FormerHolderRecord,
  LibraryFilter,
  LibraryQuery,
  SavedSpecIdRecord,
  SpecIdChangeRecord,
  SpecIdRepository,
} from '../../domain/spec-id-repository.js';

/** The SpecIdRepository contract, in memory. A test double, never used in production. */
export class InMemorySpecIdRepository implements SpecIdRepository {
  private readonly saved = new Map<string, SavedSpecId>();
  private readonly changes: SpecIdChange[] = [];
  private readonly saverNames = new Map<string, string>();

  /** Teaches the fake a saver's name, as the real repository reads it from accounts. */
  nameSaver(accountId: string, fullName: string): void {
    this.saverNames.set(accountId, fullName);
  }

  /** How many Spec IDs are held. */
  get size(): number {
    return this.saved.size;
  }

  /** How many history entries are held. */
  get changeCount(): number {
    return this.changes.length;
  }

  async add(saved: SavedSpecId, created: SpecIdChange): Promise<Result<void, SpecIdExistsError>> {
    if (this.holderOf(saved.specId.code)) return err(new SpecIdExistsError());
    this.saved.set(saved.id, saved);
    this.changes.push(created);
    return ok(undefined);
  }

  async update(
    saved: SavedSpecId,
    change: SpecIdChange,
    expectedVersion: number,
  ): Promise<Result<void, SpecIdExistsError | SpecIdChangedError>> {
    const current = this.saved.get(saved.id);
    if (!current || current.version !== expectedVersion) return err(new SpecIdChangedError());
    const holder = this.holderOf(saved.specId.code);
    if (holder && holder.id !== saved.id) return err(new SpecIdExistsError());
    this.saved.set(saved.id, saved);
    this.changes.push(change);
    return ok(undefined);
  }

  async findById(id: string): Promise<SavedSpecIdRecord | null> {
    const saved = this.saved.get(id);
    return saved ? this.record(saved) : null;
  }

  async findByCode(code: string): Promise<SavedSpecIdRecord | null> {
    const saved = this.holderOf(code);
    return saved ? this.record(saved) : null;
  }

  async findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]> {
    return [...this.saved.values()]
      .filter((saved) => classifyMatch((key) => saved.specId.slot(key), criteria) !== 'excluded')
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime() || compare(a.specId.code, b.specId.code))
      .map((saved) => this.record(saved));
  }

  async count(filter: LibraryFilter): Promise<number> {
    return this.matching(filter).length;
  }

  async list(query: LibraryQuery): Promise<SavedSpecIdRecord[]> {
    const offset = query.offset ?? 0;
    return this.matching(query)
      .sort(newestChangeFirst)
      .slice(offset, offset + query.limit)
      .map((saved) => this.record(saved));
  }

  private matching(filter: LibraryFilter): SavedSpecId[] {
    const q = filter.q?.toLowerCase();
    return [...this.saved.values()]
      .filter((saved) => q === undefined || saved.name.toLowerCase().includes(q))
      .filter((saved) => filter.productType === undefined || saved.specId.slot('productType') === filter.productType);
  }

  async history(id: string): Promise<SpecIdChangeRecord[]> {
    return this.changes
      .filter((change) => change.specId === id)
      .reverse()
      .map((change) => ({ change, changedByName: this.nameOf(change.changedBy) }));
  }

  async formerHolders(code: string): Promise<FormerHolderRecord[]> {
    const seen = new Set<string>();
    const former: FormerHolderRecord[] = [];
    for (const change of [...this.changes].reverse()) {
      const saved = this.saved.get(change.specId);
      if (change.codeBefore !== code || !saved || seen.has(saved.id)) continue;
      seen.add(saved.id);
      former.push({ record: this.record(saved), until: change.changedAt });
    }
    return former;
  }

  private holderOf(code: string): SavedSpecId | undefined {
    return [...this.saved.values()].find((saved) => saved.specId.code === code);
  }

  private record(savedSpecId: SavedSpecId): SavedSpecIdRecord {
    const { updatedBy } = savedSpecId;
    return {
      savedSpecId,
      savedByName: this.nameOf(savedSpecId.savedBy),
      updatedByName: updatedBy === null ? null : this.nameOf(updatedBy),
    };
  }

  private nameOf(accountId: string): string {
    return this.saverNames.get(accountId) ?? 'Unknown';
  }
}

type Ordered = { readonly lastChangedAt: Date; readonly id: string };

/** Negative when `a` comes first in the library: the newer change, then the greater id. */
function newestChangeFirst(a: Ordered, b: Ordered): number {
  return b.lastChangedAt.getTime() - a.lastChangedAt.getTime() || compare(b.id, a.id);
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
