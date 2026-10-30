import { and, asc, count, desc, eq, ilike, inArray, like, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import { accountsTable } from '../../accounts/index.js';
import type { SavedSpecId } from '../domain/saved-spec-id.js';
import type { SimilarCriteria } from '../domain/similar-match.js';
import { SEARCHABLE_SLOTS } from '../domain/similar-match.js';
import type { SpecIdChange } from '../domain/spec-id-change.js';
import { NOT_KNOWN, slotDefinition, type DictionarySlotKey } from '../domain/slots.js';
import { SpecIdChangedError, SpecIdExistsError } from '../domain/spec-id.errors.js';
import type {
  FormerHolderRecord,
  LibraryFilter,
  LibraryQuery,
  SavedSpecIdRecord,
  SpecIdChangeRecord,
  SpecIdRepository,
} from '../domain/spec-id-repository.js';
import { DictionaryMovedOnError } from '../domain/suggestions/suggestion.errors.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { lockDictionaryShared } from './dictionary-change-lock.js';
import { toChange, toChangeRow, toDomain, toRow } from './saved-spec-id.mapper.js';

/** Whoever last changed a Spec ID: the accounts table a second time. */
const updater = alias(accountsTable, 'updater');
const suggester = alias(accountsTable, 'suggester');
const approver = alias(accountsTable, 'approver');

/** When a Spec ID was saved or last changed: the library's order. */
const lastChangedAt = sql`coalesce(${atlasSpecIds.updatedAt}, ${atlasSpecIds.savedAt})`;

/** Thrown inside a transaction to roll it back when the version moved on. */
class VersionMovedOn extends Error {}

/** Thrown inside a transaction to roll it back when the code was built from a dictionary an approval has since changed. */
class DictionaryMovedOn extends Error {}

/**
 * Inserts, updates and selects saved Spec IDs, writing each one's history
 * entry in the same transaction. It never deletes (ADR 0022). Each insert and
 * update holds the dictionary lock shared, so it waits for an approval under
 * way, and an approval waits for it (ADR 0031).
 */
export class DrizzleSpecIdRepository implements SpecIdRepository {
  constructor(private readonly db: Database) {}

  async add(
    saved: SavedSpecId,
    created: SpecIdChange,
    dictionaryChange: number | null,
  ): Promise<Result<void, SpecIdExistsError | DictionaryMovedOnError>> {
    try {
      await this.db.transaction(async (tx) => {
        if ((await lockDictionaryShared(tx)) !== dictionaryChange) throw new DictionaryMovedOn();
        await tx.insert(atlasSpecIds).values(toRow(saved));
        await tx.insert(atlasSpecIdChanges).values(toChangeRow(created));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof DictionaryMovedOn) return err(new DictionaryMovedOnError());
      if (isUniqueViolation(error)) return err(new SpecIdExistsError());
      throw error;
    }
  }

  async update(
    saved: SavedSpecId,
    change: SpecIdChange,
    expectedVersion: number,
    dictionaryChange: number | null,
  ): Promise<Result<void, SpecIdExistsError | SpecIdChangedError | DictionaryMovedOnError>> {
    // Who saved it and when never change.
    const { id, savedBy: _savedBy, savedAt: _savedAt, ...columns } = toRow(saved);
    try {
      await this.db.transaction(async (tx) => {
        if ((await lockDictionaryShared(tx)) !== dictionaryChange) throw new DictionaryMovedOn();
        // Only the version the change started from is overwritten: a second
        // change from the same version finds it gone and is refused.
        const updated = await tx
          .update(atlasSpecIds)
          .set(columns)
          .where(and(eq(atlasSpecIds.id, id), eq(atlasSpecIds.version, expectedVersion)))
          .returning({ id: atlasSpecIds.id });
        if (updated.length === 0) throw new VersionMovedOn();
        await tx.insert(atlasSpecIdChanges).values(toChangeRow(change));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof DictionaryMovedOn) return err(new DictionaryMovedOnError());
      if (error instanceof VersionMovedOn) return err(new SpecIdChangedError());
      if (isUniqueViolation(error)) return err(new SpecIdExistsError());
      throw error;
    }
  }

  async findById(id: string): Promise<SavedSpecIdRecord | null> {
    const [row] = await this.selectWithNames().where(eq(atlasSpecIds.id, id));
    return row ? toRecord(row) : null;
  }

  async findByCode(code: string): Promise<SavedSpecIdRecord | null> {
    const [row] = await this.selectWithNames().where(eq(atlasSpecIds.code, code));
    return row ? toRecord(row) : null;
  }

  async findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]> {
    // Each chosen slot equals the value, or is not known (Y, or written wide by an older API
    // during a deploy): the use case sorts the two apart.
    const conditions = SEARCHABLE_SLOTS.flatMap((key) => {
      const wanted = criteria[key];
      const notKnown = [NOT_KNOWN, '0'.repeat(slotDefinition(key).width)];
      return wanted === undefined ? [] : [inArray(atlasSpecIds[key], [wanted, ...notKnown])];
    });
    const rows = await this.selectWithNames()
      .where(and(...conditions))
      .orderBy(desc(atlasSpecIds.savedAt), asc(atlasSpecIds.code));
    return rows.map(toRecord);
  }

  async usageOf(slot: DictionarySlotKey, code: string): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(atlasSpecIds).where(holdsOption(slot, code));
    return Number(row?.total ?? 0);
  }

  async holding(slot: DictionarySlotKey, code: string): Promise<SavedSpecIdRecord[]> {
    const rows = await this.selectWithNames().where(holdsOption(slot, code)).orderBy(asc(atlasSpecIds.code));
    return rows.map(toRecord);
  }

  async count(filter: LibraryFilter): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(atlasSpecIds).where(and(...this.libraryFilters(filter)));
    return Number(row?.total ?? 0);
  }

  async list(query: LibraryQuery): Promise<SavedSpecIdRecord[]> {
    const rows = await this.selectWithNames()
      .where(and(...this.libraryFilters(query)))
      .orderBy(desc(lastChangedAt), desc(atlasSpecIds.id))
      .offset(query.offset ?? 0)
      .limit(query.limit);
    return rows.map(toRecord);
  }

  private libraryFilters(filter: LibraryFilter): SQL[] {
    const conditions: SQL[] = [];
    if (filter.q !== undefined) conditions.push(ilike(atlasSpecIds.name, `%${escapeLike(filter.q)}%`));
    if (filter.productType !== undefined) conditions.push(eq(atlasSpecIds.productType, filter.productType));
    return conditions;
  }

  async history(id: string): Promise<SpecIdChangeRecord[]> {
    const rows = await this.db
      .select({
        change: atlasSpecIdChanges,
        changedByName: accountsTable.fullName,
        suggestedBy: suggester.id,
        suggestedByName: suggester.fullName,
        approvedBy: approver.id,
        approvedByName: approver.fullName,
      })
      .from(atlasSpecIdChanges)
      .innerJoin(accountsTable, eq(atlasSpecIdChanges.changedBy, accountsTable.id))
      .leftJoin(atlasDictionaryChanges, eq(atlasSpecIdChanges.dictionaryChangeNumber, atlasDictionaryChanges.number))
      .leftJoin(atlasDictionarySuggestions, eq(atlasDictionaryChanges.suggestionId, atlasDictionarySuggestions.id))
      .leftJoin(suggester, eq(atlasDictionarySuggestions.suggestedBy, suggester.id))
      .leftJoin(approver, eq(atlasDictionaryChanges.approvedBy, approver.id))
      .where(eq(atlasSpecIdChanges.specId, id))
      // `updated` sorts before `created`, so a creation is last even at the same instant.
      .orderBy(desc(atlasSpecIdChanges.changedAt), desc(atlasSpecIdChanges.kind), desc(atlasSpecIdChanges.id));
    return rows.map((row) => {
      const number = row.change.dictionaryChangeNumber;
      const dictionaryChange =
        number !== null && row.suggestedBy !== null && row.approvedBy !== null
          ? {
              number,
              suggestedBy: { id: row.suggestedBy, fullName: row.suggestedByName ?? '' },
              approvedBy: { id: row.approvedBy, fullName: row.approvedByName ?? '' },
            }
          : null;
      return { change: toChange(row.change), changedByName: row.changedByName, dictionaryChange };
    });
  }

  async formerHolders(code: string): Promise<FormerHolderRecord[]> {
    const moves = await this.db
      .select({ specId: atlasSpecIdChanges.specId, until: atlasSpecIdChanges.changedAt })
      .from(atlasSpecIdChanges)
      .where(eq(atlasSpecIdChanges.codeBefore, code))
      .orderBy(desc(atlasSpecIdChanges.changedAt), desc(atlasSpecIdChanges.id));

    const former: FormerHolderRecord[] = [];
    const seen = new Set<string>();
    for (const move of moves) {
      if (seen.has(move.specId)) continue;
      seen.add(move.specId);
      const record = await this.findById(move.specId);
      if (record) former.push({ record, until: move.until });
    }
    return former;
  }

  private selectWithNames() {
    return this.db
      .select({ spec: atlasSpecIds, savedByName: accountsTable.fullName, updatedByName: updater.fullName })
      .from(atlasSpecIds)
      .innerJoin(accountsTable, eq(atlasSpecIds.savedBy, accountsTable.id))
      .leftJoin(updater, eq(atlasSpecIds.updatedBy, updater.id));
  }
}

function toRecord(row: {
  spec: typeof atlasSpecIds.$inferSelect;
  savedByName: string;
  updatedByName: string | null;
}): SavedSpecIdRecord {
  return { savedSpecId: toDomain(row.spec), savedByName: row.savedByName, updatedByName: row.updatedByName };
}

/** `%`, `_` and `\` mean themselves in a search, not LIKE's wildcards. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * A slot holding a dictionary option, by its number. A capacity holds its
 * unit's number as its first digit, and no unit is a wildcard (`isOptionCode`).
 */
export function holdsOption(slot: DictionarySlotKey, code: string): SQL {
  const column = atlasSpecIds[slot];
  return slot === 'capacity' ? like(column, `${code}%`) : eq(column, code);
}
