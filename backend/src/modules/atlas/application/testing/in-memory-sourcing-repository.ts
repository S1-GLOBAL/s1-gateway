import { type Manufacturer, manufacturerKey } from '../../domain/sourcing/manufacturer.js';
import type { Quote } from '../../domain/sourcing/quote.js';
import type {
  QuoteRecord,
  QuoteToRecord,
  SourcingRepository,
  StageChangeRecord,
  StageChangeToRecord,
} from '../../domain/sourcing/sourcing-repository.js';
import { recordedAt, type Stage, type StageChange, stageOf } from '../../domain/sourcing/stage.js';

/** The SourcingRepository contract, in memory. A test double, never used in production. */
export class InMemorySourcingRepository implements SourcingRepository {
  private readonly manufacturers = new Map<string, Manufacturer>();
  private quotes: Quote[] = [];
  private readonly stageChanges: StageChange[] = [];
  private readonly changerNames = new Map<string, string>();
  /** How many times `replaceQuotes` was called. */
  replaced = 0;

  /** Teaches the fake a changer's name, as the real repository reads it from accounts. */
  nameChanger(accountId: string, fullName: string): void {
    this.changerNames.set(accountId, fullName);
  }

  /** Every stage change held, oldest first. */
  get allStageChanges(): StageChange[] {
    return [...this.stageChanges];
  }

  /** Every manufacturer held, in the order first added. */
  get allManufacturers(): Manufacturer[] {
    return [...this.manufacturers.values()];
  }

  /** Every quote held. */
  get allQuotes(): Quote[] {
    return [...this.quotes];
  }

  async replaceQuotes(quotes: readonly QuoteToRecord[]): Promise<void> {
    this.replaced += 1;
    const next: Quote[] = [];
    for (const quote of quotes) {
      const key = manufacturerKey(quote.manufacturer.name);
      const known = this.manufacturers.get(key);
      const manufacturer: Manufacturer = known
        ? { ...known, country: quote.manufacturer.country ?? known.country }
        : { id: quote.manufacturer.id, name: quote.manufacturer.name.trim(), country: quote.manufacturer.country, createdAt: quote.importedAt };
      this.manufacturers.set(key, manufacturer);
      next.push({ id: quote.id, specId: quote.specId, manufacturerId: manufacturer.id, values: quote.values, importedAt: quote.importedAt });
    }
    this.quotes = next;
  }

  async quotesOf(specId: string): Promise<QuoteRecord[]> {
    const byId = new Map([...this.manufacturers.values()].map((manufacturer) => [manufacturer.id, manufacturer]));
    return this.quotes
      .filter((quote) => quote.specId === specId)
      .map((quote) => ({ quote, manufacturer: byId.get(quote.manufacturerId) as Manufacturer }))
      .sort(
        (a, b) =>
          manufacturerKey(a.manufacturer.name).localeCompare(manufacturerKey(b.manufacturer.name)) ||
          (a.quote.values.itemName ?? '').localeCompare(b.quote.values.itemName ?? '') ||
          a.quote.id.localeCompare(b.quote.id),
      );
  }

  async currentStages(specId: string): Promise<StageChangeRecord[]> {
    const newest = new Map<string, StageChange>();
    for (const change of this.stageChanges) if (change.specId === specId) newest.set(change.manufacturerId, change);
    return [...newest.values()].map((change) => ({ change, changedByName: this.changerNames.get(change.changedBy) ?? '' }));
  }

  async recordStageChange(input: StageChangeToRecord): Promise<StageChange | null> {
    const newest = this.stageChanges.filter((change) => change.specId === input.specId && change.manufacturerId === input.manufacturerId).at(-1);
    const stageBefore = newest?.stageAfter ?? null;
    if (stageBefore === input.stageAfter) return null;
    const change: StageChange = { ...input, stageBefore, changedAt: recordedAt(newest?.changedAt ?? null, input.changedAt) };
    this.stageChanges.push(change);
    return change;
  }

  /** The ids of each `stagesOf` call, in order: a test sees one read per answer. */
  readonly stageReads: string[][] = [];

  async stagesOf(specIds: readonly string[]): Promise<Map<string, Stage[]>> {
    this.stageReads.push([...specIds]);
    const stages = new Map<string, Stage[]>();
    for (const specId of specIds) {
      const quotes = this.quotes.filter((quote) => quote.specId === specId);
      const manufacturerIds = [...new Set(quotes.map((quote) => quote.manufacturerId))];
      if (manufacturerIds.length === 0) continue;
      stages.set(
        specId,
        manufacturerIds.map((manufacturerId) => {
          const set = this.stageChanges.filter((c) => c.specId === specId && c.manufacturerId === manufacturerId).at(-1);
          const values = quotes.filter((quote) => quote.manufacturerId === manufacturerId).map((quote) => quote.values);
          return stageOf(values, set?.stageAfter ?? null);
        }),
      );
    }
    return stages;
  }
}
