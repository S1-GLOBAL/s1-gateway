import { err, ok, type Result } from '../../../../shared/domain/result.js';
import { QuoteSuggestionChangedError } from '../../domain/sourcing/quote-suggestion.errors.js';
import type { QuoteSuggestion, QuoteSuggestionEvent, QuoteSuggestionStep } from '../../domain/sourcing/quote-suggestion.js';
import type {
  ApprovedQuote,
  QuoteSuggestionEventRecord,
  QuoteSuggestionListFilter,
  QuoteSuggestionRecord,
  QuoteSuggestionRepository,
} from '../../domain/sourcing/quote-suggestion-repository.js';
import type { SpecIdRepository } from '../../domain/spec-id-repository.js';
import type { InMemorySourcingRepository } from './in-memory-sourcing-repository.js';

/**
 * The QuoteSuggestionRepository contract, in memory. A test double, never
 * used in production. An approval records its quote in the sourcing fake, as
 * the real one does in the same transaction.
 */
export class InMemoryQuoteSuggestionRepository implements QuoteSuggestionRepository {
  private readonly suggestions = new Map<string, QuoteSuggestion>();
  private readonly trail: QuoteSuggestionEvent[] = [];
  private readonly names = new Map<string, string>();

  constructor(
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: InMemorySourcingRepository,
  ) {}

  /** Teaches the fake an account's name, as the real repository reads it from accounts. */
  name(accountId: string, fullName: string): void {
    this.names.set(accountId, fullName);
  }

  async add(step: QuoteSuggestionStep): Promise<void> {
    this.suggestions.set(step.suggestion.id, step.suggestion);
    this.trail.push(step.event);
  }

  async save(step: QuoteSuggestionStep, expectedVersion: number): Promise<Result<void, QuoteSuggestionChangedError>> {
    const stored = this.suggestions.get(step.suggestion.id);
    if (!stored || stored.version !== expectedVersion || stored.state !== 'waiting') return err(new QuoteSuggestionChangedError());
    this.suggestions.set(step.suggestion.id, step.suggestion);
    this.trail.push(step.event);
    return ok(undefined);
  }

  async approve(step: QuoteSuggestionStep, expectedVersion: number, quote: ApprovedQuote): Promise<Result<void, QuoteSuggestionChangedError>> {
    const saved = await this.save(step, expectedVersion);
    if (!saved.ok) return saved;
    const { suggestion } = step;
    const { manufacturer, values } = suggestion.proposal;
    this.sourcing.addApprovedQuote({
      quote: { id: quote.quoteId, specId: suggestion.specId, values, importedAt: quote.at, suggestionId: suggestion.id },
      manufacturer:
        manufacturer.kind === 'existing'
          ? manufacturer
          : { kind: 'new', id: quote.newManufacturerId, name: manufacturer.name, country: manufacturer.country },
    });
    return ok(undefined);
  }

  async findById(id: string): Promise<QuoteSuggestionRecord | null> {
    const suggestion = this.suggestions.get(id);
    return suggestion ? this.recordOf(suggestion) : null;
  }

  async list(filter: QuoteSuggestionListFilter, specId?: string): Promise<QuoteSuggestionRecord[]> {
    const chosen = [...this.suggestions.values()].filter(
      (suggestion) => (filter === 'waiting') === (suggestion.state === 'waiting') && (specId === undefined || suggestion.specId === specId),
    );
    const sorted =
      filter === 'waiting'
        ? chosen.sort((a, b) => a.suggestedAt.getTime() - b.suggestedAt.getTime())
        : chosen.sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));
    return Promise.all(sorted.map((suggestion) => this.recordOf(suggestion)));
  }

  async events(suggestionId: string): Promise<QuoteSuggestionEventRecord[]> {
    return this.trail.filter((event) => event.suggestionId === suggestionId).map((event) => ({ event, byName: this.nameOf(event.by) }));
  }

  async countWaitingNotSuggestedBy(accountId: string): Promise<number> {
    return [...this.suggestions.values()].filter((suggestion) => suggestion.state === 'waiting' && suggestion.suggestedBy !== accountId).length;
  }

  private nameOf(accountId: string): string {
    return this.names.get(accountId) ?? accountId;
  }

  private async recordOf(suggestion: QuoteSuggestion): Promise<QuoteSuggestionRecord> {
    const spec = await this.specIds.findById(suggestion.specId);
    const { manufacturer } = suggestion.proposal;
    const chosen = manufacturer.kind === 'existing' ? await this.sourcing.findManufacturer(manufacturer.id) : null;
    return {
      suggestion,
      suggestedByName: this.nameOf(suggestion.suggestedBy),
      decidedByName: suggestion.decidedBy === null ? null : this.nameOf(suggestion.decidedBy),
      specName: spec?.savedSpecId.name ?? '',
      specCode: spec?.savedSpecId.specId.code ?? '',
      manufacturerName: manufacturer.kind === 'existing' ? (chosen?.name ?? '') : manufacturer.name,
      manufacturerCountry: manufacturer.kind === 'existing' ? (chosen?.country ?? null) : manufacturer.country,
    };
  }
}
