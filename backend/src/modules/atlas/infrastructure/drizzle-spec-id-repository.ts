import { and, asc, desc, eq, ilike, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import { accountsTable } from '../../accounts/index.js';
import { storedForms } from '../domain/s1-code.js';
import type { SavedSpecId } from '../domain/saved-spec-id.js';
import type { SimilarCriteria } from '../domain/similar-match.js';
import { SEARCHABLE_SLOTS } from '../domain/similar-match.js';
import type { SpecIdChange } from '../domain/spec-id-change.js';
import { notKnownMarker } from '../domain/slots.js';
import { SpecIdChangedError, SpecIdExistsError } from '../domain/spec-id.errors.js';
import type {
  FormerHolderRecord,
  LibraryQuery,
  SavedSpecIdRecord,
  SpecIdChangeRecord,
  SpecIdRepository,
} from '../domain/spec-id-repository.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { toChange, toChangeRow, toDomain, toRow } from './saved-spec-id.mapper.js';

/** Whoever last changed a Spec ID: the accounts table a second time. */
const updater = alias(accountsTable, 'updater');

/** When a Spec ID was saved or last changed: the library's order. */
const lastChangedAt = sql`coalesce(${atlasSpecIds.updatedAt}, ${atlasSpecIds.savedAt})`;

/** Thrown inside a transaction to roll it back when the version moved on. */
class VersionMovedOn extends Error {}

/** Thrown inside a transaction to roll it back when another Spec ID holds the code in S1 form. */
class HeldInS1Form extends Error {}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Inserts, updates and selects saved Spec IDs, writing each one's history
 * entry in the same transaction. It never deletes (ADR 0022).
 */
export class DrizzleSpecIdRepository implements SpecIdRepository {
  constructor(private readonly db: Database) {}

  async add(saved: SavedSpecId, created: SpecIdChange): Promise<Result<void, SpecIdExistsError>> {
    try {
      await this.db.transaction(async (tx) => {
        if (await this.heldInS1Form(tx, saved)) throw new HeldInS1Form();
        await tx.insert(atlasSpecIds).values(toRow(saved));
        await tx.insert(atlasSpecIdChanges).values(toChangeRow(created));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof HeldInS1Form || isUniqueViolation(error)) return err(new SpecIdExistsError());
      throw error;
    }
  }

  async update(
    saved: SavedSpecId,
    change: SpecIdChange,
    expectedVersion: number,
  ): Promise<Result<void, SpecIdExistsError | SpecIdChangedError>> {
    // Who saved it and when never change.
    const { id, savedBy: _savedBy, savedAt: _savedAt, ...columns } = toRow(saved);
    try {
      await this.db.transaction(async (tx) => {
        // Only the version the change started from is overwritten: a second
        // change from the same version finds it gone and is refused.
        const updated = await tx
          .update(atlasSpecIds)
          .set(columns)
          .where(and(eq(atlasSpecIds.id, id), eq(atlasSpecIds.version, expectedVersion)))
          .returning({ id: atlasSpecIds.id });
        if (updated.length === 0) throw new VersionMovedOn();
        if (await this.heldInS1Form(tx, saved)) throw new HeldInS1Form();
        await tx.insert(atlasSpecIdChanges).values(toChangeRow(change));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof VersionMovedOn) return err(new SpecIdChangedError());
      if (error instanceof HeldInS1Form || isUniqueViolation(error)) return err(new SpecIdExistsError());
      throw error;
    }
  }

  async findById(id: string): Promise<SavedSpecIdRecord | null> {
    const [row] = await this.selectWithNames().where(eq(atlasSpecIds.id, id));
    return row ? toRecord(row) : null;
  }

  async findByCode(code: string): Promise<SavedSpecIdRecord | null> {
    const [row] = await this.selectWithNames().where(inArray(atlasSpecIds.code, storedForms(code)));
    return row ? toRecord(row) : null;
  }

  async findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]> {
    // Each chosen slot equals the value, or is all 0 (not known): the use case sorts the two apart.
    const conditions = SEARCHABLE_SLOTS.flatMap((key) => {
      const wanted = criteria[key];
      return wanted === undefined ? [] : [inArray(atlasSpecIds[key], [wanted, notKnownMarker(key)])];
    });
    const rows = await this.selectWithNames()
      .where(and(...conditions))
      .orderBy(desc(atlasSpecIds.savedAt), asc(atlasSpecIds.code));
    return rows.map(toRecord);
  }

  async list(query: LibraryQuery): Promise<SavedSpecIdRecord[]> {
    const conditions: SQL[] = [];
    if (query.q !== undefined) conditions.push(ilike(atlasSpecIds.name, `%${escapeLike(query.q)}%`));
    if (query.productType !== undefined) conditions.push(eq(atlasSpecIds.productType, query.productType));
    if (query.after !== undefined) {
      // Keyset paging: strictly after the last row of the page before, in the same order.
      const { lastChangedAt: at, id } = query.after;
      conditions.push(sql`(${lastChangedAt}, ${atlasSpecIds.id}) < (${at.toISOString()}::timestamptz, ${id}::uuid)`);
    }
    const rows = await this.selectWithNames()
      .where(and(...conditions))
      .orderBy(desc(lastChangedAt), desc(atlasSpecIds.id))
      .limit(query.limit);
    return rows.map(toRecord);
  }

  async history(id: string): Promise<SpecIdChangeRecord[]> {
    const rows = await this.db
      .select({ change: atlasSpecIdChanges, changedByName: accountsTable.fullName })
      .from(atlasSpecIdChanges)
      .innerJoin(accountsTable, eq(atlasSpecIdChanges.changedBy, accountsTable.id))
      .where(eq(atlasSpecIdChanges.specId, id))
      // `updated` sorts before `created`, so a creation is last even at the same instant.
      .orderBy(desc(atlasSpecIdChanges.changedAt), desc(atlasSpecIdChanges.kind), desc(atlasSpecIdChanges.id));
    return rows.map((row) => ({ change: toChange(row.change), changedByName: row.changedByName }));
  }

  async formerHolders(code: string): Promise<FormerHolderRecord[]> {
    const moves = await this.db
      .select({ specId: atlasSpecIdChanges.specId, until: atlasSpecIdChanges.changedAt })
      .from(atlasSpecIdChanges)
      .where(inArray(atlasSpecIdChanges.codeBefore, storedForms(code)))
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

  /**
   * Whether another Spec ID still holds this code in S1 form, saved by an
   * older API during a deploy: the unique index cannot see the two forms as one.
   */
  private async heldInS1Form(tx: Transaction, saved: SavedSpecId): Promise<boolean> {
    const [, s1] = storedForms(saved.specId.code);
    if (s1 === undefined) return false;
    const rows = await tx
      .select({ id: atlasSpecIds.id })
      .from(atlasSpecIds)
      .where(and(eq(atlasSpecIds.code, s1), ne(atlasSpecIds.id, saved.id)));
    return rows.length > 0;
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
