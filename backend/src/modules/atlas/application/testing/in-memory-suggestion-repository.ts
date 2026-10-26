import { err, ok, type Result } from '../../../../shared/domain/result.js';
import { SuggestionChangedError } from '../../domain/suggestions/suggestion.errors.js';
import type {
  SuggestionEventRecord,
  SuggestionListFilter,
  SuggestionRecord,
  SuggestionRepository,
} from '../../domain/suggestions/suggestion-repository.js';
import type { Suggestion, SuggestionEvent, SuggestionStep } from '../../domain/suggestions/suggestion.js';

/** The SuggestionRepository contract, in memory. A test double, never used in production. */
export class InMemorySuggestionRepository implements SuggestionRepository {
  private readonly suggestions = new Map<string, Suggestion>();
  private readonly trail: SuggestionEvent[] = [];
  private readonly names = new Map<string, string>();

  /** Teaches the fake an account's name, as the real repository reads it from accounts. */
  nameAccount(accountId: string, fullName: string): void {
    this.names.set(accountId, fullName);
  }

  async add(step: SuggestionStep): Promise<void> {
    this.suggestions.set(step.suggestion.id, step.suggestion);
    this.trail.push(step.event);
  }

  async save(step: SuggestionStep, expectedVersion: number): Promise<Result<void, SuggestionChangedError>> {
    const stored = this.suggestions.get(step.suggestion.id);
    if (!stored || stored.version !== expectedVersion || stored.state !== 'waiting') {
      return err(new SuggestionChangedError());
    }
    this.suggestions.set(step.suggestion.id, step.suggestion);
    this.trail.push(step.event);
    return ok(undefined);
  }

  async findById(id: string): Promise<SuggestionRecord | null> {
    const suggestion = this.suggestions.get(id);
    return suggestion ? this.record(suggestion) : null;
  }

  async list(filter: SuggestionListFilter): Promise<SuggestionRecord[]> {
    const all = [...this.suggestions.values()];
    const listed =
      filter === 'waiting'
        ? all.filter((s) => s.state === 'waiting').sort((a, b) => a.suggestedAt.getTime() - b.suggestedAt.getTime())
        : all
            .filter((s) => s.state !== 'waiting')
            .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));
    return listed.map((suggestion) => this.record(suggestion));
  }

  async events(suggestionId: string): Promise<SuggestionEventRecord[]> {
    return this.trail
      .filter((event) => event.suggestionId === suggestionId)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((event) => ({ event, byName: this.nameOf(event.by) }));
  }

  async countWaitingNotSuggestedBy(accountId: string): Promise<number> {
    return [...this.suggestions.values()].filter((s) => s.state === 'waiting' && s.suggestedBy !== accountId).length;
  }

  private record(suggestion: Suggestion): SuggestionRecord {
    return {
      suggestion,
      suggestedByName: this.nameOf(suggestion.suggestedBy),
      decidedByName: suggestion.decidedBy === null ? null : this.nameOf(suggestion.decidedBy),
    };
  }

  private nameOf(accountId: string): string {
    return this.names.get(accountId) ?? accountId;
  }
}
