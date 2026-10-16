import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import { accountsTable } from '../../accounts/index.js';
import type { SavedSpecId } from '../domain/saved-spec-id.js';
import type { SimilarCriteria } from '../domain/similar-match.js';
import { SEARCHABLE_SLOTS } from '../domain/similar-match.js';
import { notKnownMarker } from '../domain/slots.js';
import { SpecIdExistsError } from '../domain/spec-id.errors.js';
import type { SavedSpecIdRecord, SpecIdRepository } from '../domain/spec-id-repository.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { toDomain, toRow } from './saved-spec-id.mapper.js';

/** Inserts and selects saved Spec IDs. It never updates or deletes one (ADR 0021). */
export class DrizzleSpecIdRepository implements SpecIdRepository {
  constructor(private readonly db: Database) {}

  async add(saved: SavedSpecId): Promise<Result<void, SpecIdExistsError>> {
    try {
      await this.db.insert(atlasSpecIds).values(toRow(saved));
      return ok(undefined);
    } catch (error) {
      if (isUniqueViolation(error)) return err(new SpecIdExistsError());
      throw error;
    }
  }

  async findByCode(code: string): Promise<SavedSpecIdRecord | null> {
    const [row] = await this.selectWithSaver().where(eq(atlasSpecIds.code, code));
    return row ? toRecord(row) : null;
  }

  async findCandidates(criteria: SimilarCriteria): Promise<SavedSpecIdRecord[]> {
    // Each chosen slot equals the value, or is all 0 (not known): the use case sorts the two apart.
    const conditions = SEARCHABLE_SLOTS.flatMap((key) => {
      const wanted = criteria[key];
      return wanted === undefined ? [] : [inArray(atlasSpecIds[key], [wanted, notKnownMarker(key)])];
    });
    const rows = await this.selectWithSaver()
      .where(and(...conditions))
      .orderBy(desc(atlasSpecIds.savedAt), asc(atlasSpecIds.code));
    return rows.map(toRecord);
  }

  private selectWithSaver() {
    return this.db
      .select({ spec: atlasSpecIds, savedByName: accountsTable.fullName })
      .from(atlasSpecIds)
      .innerJoin(accountsTable, eq(atlasSpecIds.savedBy, accountsTable.id));
  }
}

function toRecord(row: { spec: typeof atlasSpecIds.$inferSelect; savedByName: string }): SavedSpecIdRecord {
  return { savedSpecId: toDomain(row.spec), savedByName: row.savedByName };
}
