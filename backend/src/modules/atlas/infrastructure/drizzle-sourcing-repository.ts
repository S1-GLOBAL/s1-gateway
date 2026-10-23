import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { accountsTable } from '../../accounts/index.js';
import { manufacturerKey } from '../domain/sourcing/manufacturer.js';
import type {
  QuoteRecord,
  QuoteToRecord,
  SourcingRepository,
  StageChangeRecord,
  StageChangeToRecord,
} from '../domain/sourcing/sourcing-repository.js';
import { recordedAt, stageOfPriced, type AdminStage, type Stage, type StageChange } from '../domain/sourcing/stage.js';
import { atlasManufacturerStageChanges } from './atlas-manufacturer-stage-changes.table.js';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasQuotes } from './atlas-quotes.table.js';

/** Rows per insert, well under Postgres's 65,535 parameters. */
const CHUNK = 500;

/** The SourcingRepository contract, over Postgres (ADR 0027). */
export class DrizzleSourcingRepository implements SourcingRepository {
  constructor(private readonly db: Database) {}

  async replaceQuotes(quotes: readonly QuoteToRecord[]): Promise<void> {
    // One row per manufacturer: the first name written, the last country given.
    const manufacturers = new Map<string, typeof atlasManufacturers.$inferInsert>();
    for (const { manufacturer, importedAt } of quotes) {
      const nameKey = manufacturerKey(manufacturer.name);
      const known = manufacturers.get(nameKey);
      manufacturers.set(nameKey, {
        id: known?.id ?? manufacturer.id,
        name: known?.name ?? manufacturer.name.trim(),
        nameKey,
        country: manufacturer.country ?? known?.country ?? null,
        createdAt: known?.createdAt ?? importedAt,
      });
    }

    await this.db.transaction(async (tx) => {
      const ids = new Map<string, string>();
      const rows = [...manufacturers.values()];
      for (let start = 0; start < rows.length; start += CHUNK) {
        const saved = await tx
          .insert(atlasManufacturers)
          .values(rows.slice(start, start + CHUNK))
          .onConflictDoUpdate({
            target: atlasManufacturers.nameKey,
            set: { country: sql`coalesce(excluded.country, ${atlasManufacturers.country})` },
          })
          .returning({ id: atlasManufacturers.id, nameKey: atlasManufacturers.nameKey });
        for (const { id, nameKey } of saved) ids.set(nameKey, id);
      }

      await tx.delete(atlasQuotes);
      const quoteRows = quotes.map((quote) => ({
        id: quote.id,
        specId: quote.specId,
        manufacturerId: ids.get(manufacturerKey(quote.manufacturer.name)) as string,
        ...quote.values,
        importedAt: quote.importedAt,
      }));
      for (let start = 0; start < quoteRows.length; start += CHUNK) {
        await tx.insert(atlasQuotes).values(quoteRows.slice(start, start + CHUNK));
      }
    });
  }

  async quotesOf(specId: string): Promise<QuoteRecord[]> {
    const rows = await this.db
      .select({ quote: atlasQuotes, manufacturer: atlasManufacturers })
      .from(atlasQuotes)
      .innerJoin(atlasManufacturers, eq(atlasQuotes.manufacturerId, atlasManufacturers.id))
      .where(eq(atlasQuotes.specId, specId))
      .orderBy(asc(atlasManufacturers.nameKey), asc(atlasQuotes.itemName), asc(atlasQuotes.id));
    return rows.map(({ quote, manufacturer }) => ({
      quote: {
        id: quote.id,
        specId: quote.specId,
        manufacturerId: quote.manufacturerId,
        values: {
          itemName: quote.itemName,
          fobPerUnit: quote.fobPerUnit,
          fobPerCase: quote.fobPerCase,
          fobTotal: quote.fobTotal,
          moldCost: quote.moldCost,
          moldLeadTime: quote.moldLeadTime,
          sampleLeadTime: quote.sampleLeadTime,
          productionLeadTime: quote.productionLeadTime,
        },
        importedAt: quote.importedAt,
      },
      manufacturer: { id: manufacturer.id, name: manufacturer.name, country: manufacturer.country, createdAt: manufacturer.createdAt },
    }));
  }

  async currentStages(specId: string): Promise<StageChangeRecord[]> {
    const rows = await this.db
      .selectDistinctOn([atlasManufacturerStageChanges.manufacturerId], {
        change: atlasManufacturerStageChanges,
        changedByName: accountsTable.fullName,
      })
      .from(atlasManufacturerStageChanges)
      .innerJoin(accountsTable, eq(atlasManufacturerStageChanges.changedBy, accountsTable.id))
      .where(eq(atlasManufacturerStageChanges.specId, specId))
      .orderBy(
        atlasManufacturerStageChanges.manufacturerId,
        desc(atlasManufacturerStageChanges.changedAt),
        desc(atlasManufacturerStageChanges.id),
      );
    return rows.map(({ change, changedByName }) => ({ change: toStageChange(change), changedByName }));
  }

  async recordStageChange(input: StageChangeToRecord): Promise<StageChange | null> {
    return this.db.transaction(async (tx) => {
      // Two admins at once: the second waits here, then reads the first one's change as its "before".
      await tx
        .select({ id: atlasManufacturers.id })
        .from(atlasManufacturers)
        .where(eq(atlasManufacturers.id, input.manufacturerId))
        .for('update');
      const [newest] = await tx
        .select({ stageAfter: atlasManufacturerStageChanges.stageAfter, changedAt: atlasManufacturerStageChanges.changedAt })
        .from(atlasManufacturerStageChanges)
        .where(
          and(
            eq(atlasManufacturerStageChanges.specId, input.specId),
            eq(atlasManufacturerStageChanges.manufacturerId, input.manufacturerId),
          ),
        )
        .orderBy(desc(atlasManufacturerStageChanges.changedAt), desc(atlasManufacturerStageChanges.id))
        .limit(1);
      const stageBefore = (newest?.stageAfter ?? null) as AdminStage | null;
      if (stageBefore === input.stageAfter) return null;
      const change: StageChange = { ...input, stageBefore, changedAt: recordedAt(newest?.changedAt ?? null, input.changedAt) };
      await tx.insert(atlasManufacturerStageChanges).values(change);
      return change;
    });
  }
  async stagesOf(specIds: readonly string[]): Promise<Map<string, Stage[]>> {
    const stages = new Map<string, Stage[]>();
    if (specIds.length === 0) return stages;
    // One read for a whole page of cards (#73): each manufacturer once per
    // Spec ID, whether any of its quotes there has a price, and its newest
    // admin stage there. A price has a digit, as `hasPrice` says.
    const rows = await this.db
      .select({
        specId: atlasQuotes.specId,
        priced: sql<boolean>`coalesce(bool_or(${atlasQuotes.fobPerUnit} ~ '[0-9]' or ${atlasQuotes.fobPerCase} ~ '[0-9]'), false)`,
        // Spelled out: inside a subquery, Drizzle writes a column without its
        // table, and `spec_id = spec_id` would match every change.
        set: sql<string | null>`(
          select change.stage_after from atlas_manufacturer_stage_changes change
          where change.spec_id = atlas_quotes.spec_id and change.manufacturer_id = atlas_quotes.manufacturer_id
          order by change.changed_at desc, change.id desc
          limit 1
        )`,
      })
      .from(atlasQuotes)
      .where(inArray(atlasQuotes.specId, [...specIds]))
      .groupBy(atlasQuotes.specId, atlasQuotes.manufacturerId);
    for (const { specId, priced, set } of rows) {
      stages.set(specId, [...(stages.get(specId) ?? []), stageOfPriced(priced, set as AdminStage | null)]);
    }
    return stages;
  }
}

function toStageChange(row: typeof atlasManufacturerStageChanges.$inferSelect): StageChange {
  return {
    id: row.id,
    specId: row.specId,
    manufacturerId: row.manufacturerId,
    stageBefore: row.stageBefore as AdminStage | null,
    stageAfter: row.stageAfter as AdminStage | null,
    changedBy: row.changedBy,
    changedAt: row.changedAt,
  };
}
