import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { DictionaryChangeError, DictionaryChangePlan, DictionaryChangeStore } from '../../domain/suggestions/dictionary-change-store.js';
import {
  DictionaryMovedOnError,
  SpecIdMovedOnError,
  SpecIdsWouldClashError,
  SuggestionChangedError,
} from '../../domain/suggestions/suggestion.errors.js';
import type { InMemoryDictionaryRepository } from './in-memory-dictionary-repository.js';
import type { InMemorySpecIdRepository } from './in-memory-spec-id-repository.js';
import type { InMemorySuggestionRepository } from './in-memory-suggestion-repository.js';

/**
 * The DictionaryChangeStore contract over the in-memory repositories: every
 * check first, then every write, so a refused plan writes nothing. A test
 * double, never used in production.
 */
export class InMemoryDictionaryChangeStore implements DictionaryChangeStore {
  /** The plans applied, in order. */
  readonly applied: DictionaryChangePlan[] = [];

  constructor(
    private readonly dictionaries: InMemoryDictionaryRepository,
    private readonly specIds: InMemorySpecIdRepository,
    private readonly suggestions: InMemorySuggestionRepository,
  ) {
    specIds.followDictionary(dictionaries);
  }

  async apply(plan: DictionaryChangePlan): Promise<Result<void, DictionaryChangeError>> {
    const current = await this.dictionaries.get(plan.dictionary.release);
    if ((current?.change?.number ?? null) !== plan.basedOn) return err(new DictionaryMovedOnError());

    const stored = await this.suggestions.findById(plan.suggestion.suggestion.id);
    if (!stored || stored.suggestion.version !== plan.suggestionVersion || stored.suggestion.state !== 'waiting') {
      return err(new SuggestionChangedError());
    }
    if (plan.holders) {
      const now = await this.specIds.holding(plan.holders.slot, plan.holders.code);
      const read = new Map(plan.holders.specIds.map(({ id, version }) => [id, version]));
      const same = now.length === read.size && now.every(({ savedSpecId }) => read.get(savedSpecId.id) === savedSpecId.version);
      if (!same) return err(new SpecIdMovedOnError());
    }
    for (const relettering of plan.relettered) {
      const held = await this.specIds.findById(relettering.saved.id);
      if (held?.savedSpecId.version !== relettering.expectedVersion) return err(new SpecIdMovedOnError());
    }
    for (const rewrite of plan.rewrites) {
      const held = await this.specIds.findById(rewrite.saved.id);
      if (held?.savedSpecId.version !== rewrite.expectedVersion) return err(new SpecIdMovedOnError());
      const other = await this.specIds.findByCode(rewrite.saved.specId.code);
      const movingAway = plan.rewrites.some((r) => r.saved.id === other?.savedSpecId.id);
      if (other && other.savedSpecId.id !== rewrite.saved.id && !movingAway) return err(new SpecIdsWouldClashError());
    }

    this.dictionaries.replace(plan.dictionary);
    this.specIds.recordDictionaryChange(plan.change.number, {
      suggestedBy: plan.suggestion.suggestion.suggestedBy,
      approvedBy: plan.change.approvedBy,
    });
    await this.suggestions.save(plan.suggestion, plan.suggestionVersion);
    for (const rewrite of plan.rewrites) await this.specIds.update(rewrite.saved, rewrite.change, rewrite.expectedVersion, plan.change.number);
    for (const relettering of plan.relettered) this.specIds.reletter(relettering.saved);
    this.applied.push(plan);
    return ok(undefined);
  }
}
