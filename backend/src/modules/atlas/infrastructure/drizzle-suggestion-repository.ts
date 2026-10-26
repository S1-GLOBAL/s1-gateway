import { and, asc, count, desc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { accountsTable } from '../../accounts/index.js';
import { SuggestionChangedError } from '../domain/suggestions/suggestion.errors.js';
import type {
  SuggestionEventRecord,
  SuggestionListFilter,
  SuggestionRecord,
  SuggestionRepository,
} from '../domain/suggestions/suggestion-repository.js';
import type { SuggestionStep } from '../domain/suggestions/suggestion.js';
import { atlasDictionarySuggestionEvents } from './atlas-dictionary-suggestion-events.table.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';
import { toEvent, toEventRow, toSuggestion, toSuggestionRow } from './suggestion.mapper.js';

const decider = alias(accountsTable, 'decider');

/** Thrown inside a transaction to roll it back when the stored suggestion moved on. */
class MovedOn extends Error {}

export class DrizzleSuggestionRepository implements SuggestionRepository {
  constructor(private readonly db: Database) {}

  async add(step: SuggestionStep): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(atlasDictionarySuggestions).values(toSuggestionRow(step.suggestion));
      await tx.insert(atlasDictionarySuggestionEvents).values(toEventRow(step.event));
    });
  }

  async save(step: SuggestionStep, expectedVersion: number): Promise<Result<void, SuggestionChangedError>> {
    try {
      await this.db.transaction(async (tx) => {
        const updated = await tx
          .update(atlasDictionarySuggestions)
          .set(toSuggestionRow(step.suggestion))
          .where(
            and(
              eq(atlasDictionarySuggestions.id, step.suggestion.id),
              eq(atlasDictionarySuggestions.version, expectedVersion),
              eq(atlasDictionarySuggestions.state, 'waiting'),
            ),
          )
          .returning({ id: atlasDictionarySuggestions.id });
        if (updated.length === 0) throw new MovedOn();
        await tx.insert(atlasDictionarySuggestionEvents).values(toEventRow(step.event));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof MovedOn) return err(new SuggestionChangedError());
      throw error;
    }
  }

  async findById(id: string): Promise<SuggestionRecord | null> {
    const [row] = await this.selectWithNames().where(eq(atlasDictionarySuggestions.id, id));
    return row ? toRecord(row) : null;
  }

  async list(filter: SuggestionListFilter): Promise<SuggestionRecord[]> {
    const rows =
      filter === 'waiting'
        ? await this.selectWithNames()
            .where(eq(atlasDictionarySuggestions.state, 'waiting'))
            .orderBy(asc(atlasDictionarySuggestions.suggestedAt), asc(atlasDictionarySuggestions.id))
        : await this.selectWithNames()
            .where(ne(atlasDictionarySuggestions.state, 'waiting'))
            .orderBy(desc(atlasDictionarySuggestions.decidedAt), desc(atlasDictionarySuggestions.id));
    return rows.map(toRecord);
  }

  async events(suggestionId: string): Promise<SuggestionEventRecord[]> {
    const rows = await this.db
      .select({ event: atlasDictionarySuggestionEvents, byName: accountsTable.fullName })
      .from(atlasDictionarySuggestionEvents)
      .innerJoin(accountsTable, eq(atlasDictionarySuggestionEvents.by, accountsTable.id))
      .where(eq(atlasDictionarySuggestionEvents.suggestionId, suggestionId))
      .orderBy(asc(atlasDictionarySuggestionEvents.at), asc(atlasDictionarySuggestionEvents.id));
    return rows.map((row) => ({ event: toEvent(row.event), byName: row.byName }));
  }

  async countWaitingNotSuggestedBy(accountId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(atlasDictionarySuggestions)
      .where(and(eq(atlasDictionarySuggestions.state, 'waiting'), ne(atlasDictionarySuggestions.suggestedBy, accountId)));
    return Number(row?.total ?? 0);
  }

  private selectWithNames() {
    return this.db
      .select({ suggestion: atlasDictionarySuggestions, suggestedByName: accountsTable.fullName, decidedByName: decider.fullName })
      .from(atlasDictionarySuggestions)
      .innerJoin(accountsTable, eq(atlasDictionarySuggestions.suggestedBy, accountsTable.id))
      .leftJoin(decider, eq(atlasDictionarySuggestions.decidedBy, decider.id));
  }
}

function toRecord(row: {
  suggestion: typeof atlasDictionarySuggestions.$inferSelect;
  suggestedByName: string;
  decidedByName: string | null;
}): SuggestionRecord {
  return { suggestion: toSuggestion(row.suggestion), suggestedByName: row.suggestedByName, decidedByName: row.decidedByName };
}
