import { and, asc, count, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { accountsTable } from '../../accounts/index.js';
import { manufacturerKey } from '../domain/sourcing/manufacturer.js';
import { QuoteSuggestionChangedError } from '../domain/sourcing/quote-suggestion.errors.js';
import {
  QuoteSuggestion,
  type QuoteProposal,
  type QuoteSuggestionEvent,
  type QuoteSuggestionEventKind,
  type QuoteSuggestionState,
  type QuoteSuggestionStep,
} from '../domain/sourcing/quote-suggestion.js';
import type {
  ApprovedQuote,
  QuoteSuggestionEventRecord,
  QuoteSuggestionListFilter,
  QuoteSuggestionRecord,
  QuoteSuggestionRepository,
} from '../domain/sourcing/quote-suggestion-repository.js';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasQuoteSuggestionEvents } from './atlas-quote-suggestion-events.table.js';
import { atlasQuoteSuggestions } from './atlas-quote-suggestions.table.js';
import { atlasQuotes } from './atlas-quotes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

const decider = alias(accountsTable, 'decider');

type Row = typeof atlasQuoteSuggestions.$inferSelect;
type NewRow = typeof atlasQuoteSuggestions.$inferInsert;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Thrown inside a transaction to roll it back when the stored quotation moved on. */
class MovedOn extends Error {}

/** The QuoteSuggestionRepository contract, over Postgres (ADR 0035). */
export class DrizzleQuoteSuggestionRepository implements QuoteSuggestionRepository {
  constructor(private readonly db: Database) {}

  async add(step: QuoteSuggestionStep): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(atlasQuoteSuggestions).values(toRow(step.suggestion));
      await tx.insert(atlasQuoteSuggestionEvents).values(toEventRow(step.event));
    });
  }

  async save(step: QuoteSuggestionStep, expectedVersion: number): Promise<Result<void, QuoteSuggestionChangedError>> {
    return this.inStep(step, expectedVersion, async () => undefined);
  }

  async approve(step: QuoteSuggestionStep, expectedVersion: number, quote: ApprovedQuote): Promise<Result<void, QuoteSuggestionChangedError>> {
    const { suggestion } = step;
    const { manufacturer, values } = suggestion.proposal;
    return this.inStep(step, expectedVersion, async (tx) => {
      let manufacturerId: string;
      if (manufacturer.kind === 'existing') {
        manufacturerId = manufacturer.id;
      } else {
        // Found or added by name, as the import does: one of that name made meanwhile is joined, its country kept.
        const [saved] = await tx
          .insert(atlasManufacturers)
          .values({
            id: quote.newManufacturerId,
            name: manufacturer.name,
            nameKey: manufacturerKey(manufacturer.name),
            country: manufacturer.country,
            createdAt: quote.at,
          })
          .onConflictDoUpdate({
            target: atlasManufacturers.nameKey,
            set: { country: sql`coalesce(${atlasManufacturers.country}, excluded.country)` },
          })
          .returning({ id: atlasManufacturers.id });
        if (!saved) throw new Error(`Manufacturer ${manufacturer.name} was not saved`);
        manufacturerId = saved.id;
      }
      await tx.insert(atlasQuotes).values({
        id: quote.quoteId,
        specId: suggestion.specId,
        manufacturerId,
        ...values,
        importedAt: quote.at,
        suggestionId: suggestion.id,
      });
    });
  }

  async findById(id: string): Promise<QuoteSuggestionRecord | null> {
    const [row] = await this.selectRecords(eq(atlasQuoteSuggestions.id, id));
    return row ? toRecord(row) : null;
  }

  async list(filter: QuoteSuggestionListFilter, specId?: string): Promise<QuoteSuggestionRecord[]> {
    const state = filter === 'waiting' ? eq(atlasQuoteSuggestions.state, 'waiting') : ne(atlasQuoteSuggestions.state, 'waiting');
    const where = specId === undefined ? state : and(state, eq(atlasQuoteSuggestions.specId, specId));
    const rows =
      filter === 'waiting'
        ? await this.selectRecords(where).orderBy(asc(atlasQuoteSuggestions.suggestedAt), asc(atlasQuoteSuggestions.id))
        : await this.selectRecords(where).orderBy(desc(atlasQuoteSuggestions.decidedAt), desc(atlasQuoteSuggestions.id));
    return rows.map(toRecord);
  }

  async events(suggestionId: string): Promise<QuoteSuggestionEventRecord[]> {
    const rows = await this.db
      .select({ event: atlasQuoteSuggestionEvents, byName: accountsTable.fullName })
      .from(atlasQuoteSuggestionEvents)
      .innerJoin(accountsTable, eq(atlasQuoteSuggestionEvents.by, accountsTable.id))
      .where(eq(atlasQuoteSuggestionEvents.suggestionId, suggestionId))
      .orderBy(asc(atlasQuoteSuggestionEvents.at), asc(atlasQuoteSuggestionEvents.id));
    return rows.map((row) => ({ event: toEvent(row.event), byName: row.byName }));
  }

  async countWaitingNotSuggestedBy(accountId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(atlasQuoteSuggestions)
      .where(and(eq(atlasQuoteSuggestions.state, 'waiting'), ne(atlasQuoteSuggestions.suggestedBy, accountId)));
    return Number(row?.total ?? 0);
  }

  /**
   * Saves a step over the stored quotation, from `expectedVersion` while it
   * waits, records its event, and does `also`, together; nothing when it moved on.
   */
  private async inStep(
    step: QuoteSuggestionStep,
    expectedVersion: number,
    also: (tx: Transaction) => Promise<void>,
  ): Promise<Result<void, QuoteSuggestionChangedError>> {
    try {
      await this.db.transaction(async (tx) => {
        const updated = await tx
          .update(atlasQuoteSuggestions)
          .set(toRow(step.suggestion))
          .where(
            and(
              eq(atlasQuoteSuggestions.id, step.suggestion.id),
              eq(atlasQuoteSuggestions.version, expectedVersion),
              eq(atlasQuoteSuggestions.state, 'waiting'),
            ),
          )
          .returning({ id: atlasQuoteSuggestions.id });
        if (updated.length === 0) throw new MovedOn();
        await tx.insert(atlasQuoteSuggestionEvents).values(toEventRow(step.event));
        await also(tx);
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof MovedOn) return err(new QuoteSuggestionChangedError());
      throw error;
    }
  }

  private selectRecords(where: SQL | undefined) {
    return this.db
      .select({
        suggestion: atlasQuoteSuggestions,
        suggestedByName: accountsTable.fullName,
        decidedByName: decider.fullName,
        specName: atlasSpecIds.name,
        specCode: atlasSpecIds.code,
        chosenName: atlasManufacturers.name,
        chosenCountry: atlasManufacturers.country,
      })
      .from(atlasQuoteSuggestions)
      .innerJoin(accountsTable, eq(atlasQuoteSuggestions.suggestedBy, accountsTable.id))
      .innerJoin(atlasSpecIds, eq(atlasQuoteSuggestions.specId, atlasSpecIds.id))
      .leftJoin(decider, eq(atlasQuoteSuggestions.decidedBy, decider.id))
      .leftJoin(atlasManufacturers, eq(atlasQuoteSuggestions.manufacturerId, atlasManufacturers.id))
      .where(where)
      .$dynamic();
  }
}

function proposalOf(row: Row): QuoteProposal {
  return {
    manufacturer:
      row.manufacturerId !== null
        ? { kind: 'existing', id: row.manufacturerId }
        : { kind: 'new', name: row.manufacturerName ?? '', country: row.manufacturerCountry },
    values: {
      itemName: row.itemName,
      fobPerUnit: row.fobPerUnit,
      fobPerCase: row.fobPerCase,
      fobTotal: row.fobTotal,
      moldCost: row.moldCost,
      moldLeadTime: row.moldLeadTime,
      sampleLeadTime: row.sampleLeadTime,
      productionLeadTime: row.productionLeadTime,
    },
  };
}

function toSuggestion(row: Row): QuoteSuggestion {
  return QuoteSuggestion.restore({
    id: row.id,
    specId: row.specId,
    proposal: proposalOf(row),
    state: row.state as QuoteSuggestionState,
    version: row.version,
    suggestedBy: row.suggestedBy,
    suggestedAt: row.suggestedAt,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    reason: row.reason,
    quoteId: row.quoteId,
  });
}

function toRow(suggestion: QuoteSuggestion): NewRow {
  const { manufacturer, values } = suggestion.proposal;
  return {
    id: suggestion.id,
    specId: suggestion.specId,
    manufacturerId: manufacturer.kind === 'existing' ? manufacturer.id : null,
    manufacturerName: manufacturer.kind === 'new' ? manufacturer.name : null,
    manufacturerCountry: manufacturer.kind === 'new' ? manufacturer.country : null,
    ...values,
    // Checked when it was made: a quotation always has one.
    fobPerUnit: values.fobPerUnit ?? '',
    state: suggestion.state,
    version: suggestion.version,
    suggestedBy: suggestion.suggestedBy,
    suggestedAt: suggestion.suggestedAt,
    decidedBy: suggestion.decidedBy,
    decidedAt: suggestion.decidedAt,
    reason: suggestion.reason,
    quoteId: suggestion.quoteId,
  };
}

function toEvent(row: typeof atlasQuoteSuggestionEvents.$inferSelect): QuoteSuggestionEvent {
  return {
    id: row.id,
    suggestionId: row.suggestionId,
    kind: row.kind as QuoteSuggestionEventKind,
    by: row.by,
    at: row.at,
    proposalBefore: row.proposalBefore,
    proposalAfter: row.proposalAfter,
    reason: row.reason,
  };
}

function toEventRow(event: QuoteSuggestionEvent): typeof atlasQuoteSuggestionEvents.$inferInsert {
  return {
    id: event.id,
    suggestionId: event.suggestionId,
    kind: event.kind,
    by: event.by,
    at: event.at,
    proposalBefore: event.proposalBefore,
    proposalAfter: event.proposalAfter,
    reason: event.reason,
  };
}

function toRecord(row: {
  suggestion: Row;
  suggestedByName: string;
  decidedByName: string | null;
  specName: string;
  specCode: string;
  chosenName: string | null;
  chosenCountry: string | null;
}): QuoteSuggestionRecord {
  const suggestion = toSuggestion(row.suggestion);
  const { manufacturer } = suggestion.proposal;
  return {
    suggestion,
    suggestedByName: row.suggestedByName,
    decidedByName: row.decidedByName,
    specName: row.specName,
    specCode: row.specCode,
    manufacturerName: manufacturer.kind === 'existing' ? (row.chosenName ?? '') : manufacturer.name,
    manufacturerCountry: manufacturer.kind === 'existing' ? row.chosenCountry : manufacturer.country,
  };
}
