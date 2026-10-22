import { type Manufacturer, manufacturerKey } from '../../domain/sourcing/manufacturer.js';
import type { Quote } from '../../domain/sourcing/quote.js';
import type { QuoteRecord, QuoteToRecord, SourcingRepository } from '../../domain/sourcing/sourcing-repository.js';

/** The SourcingRepository contract, in memory. A test double, never used in production. */
export class InMemorySourcingRepository implements SourcingRepository {
  private readonly manufacturers = new Map<string, Manufacturer>();
  private quotes: Quote[] = [];
  /** How many times `replaceQuotes` was called. */
  replaced = 0;

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
}
