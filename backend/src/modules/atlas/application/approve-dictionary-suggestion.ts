import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import type {
  DictionaryChangeError,
  DictionaryChangeStore,
  SpecIdRewrite,
} from '../domain/suggestions/dictionary-change-store.js';
import {
  SuggestionChangedError,
  SuggestionNotFoundError,
  type OwnSuggestionError,
  type SuggestionDecidedError,
} from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { planDictionaryChange, type PlanError } from './plan-dictionary-change.js';
import {
  toSuggestionDto,
  type ApproveDictionarySuggestionInput,
  type ApprovedSuggestionDto,
} from './suggestion.dto.js';

export type ApproveDictionarySuggestionError =
  | SuggestionNotFoundError
  | OwnSuggestionError
  | SuggestionDecidedError
  | SuggestionChangedError
  | PlanError
  | DictionaryChangeError;

/**
 * An admin who did not suggest it approves a suggestion, from the version
 * they read (#95, ADR 0031). It becomes the next numbered change: the
 * dictionary changes, and every saved Spec ID it rewrites is saved with a
 * history entry naming the change, all at once or not at all.
 */
export class ApproveDictionarySuggestion
  implements UseCase<ApproveDictionarySuggestionInput, Result<ApprovedSuggestionDto, ApproveDictionarySuggestionError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly suggestions: SuggestionRepository,
    private readonly store: DictionaryChangeStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: ApproveDictionarySuggestionInput,
  ): Promise<Result<ApprovedSuggestionDto, ApproveDictionarySuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.decisionRefusalFor(input.by.id);
    if (refused) return err(refused);
    if (suggestion.version !== input.version) return err(new SuggestionChangedError());

    const now = this.clock.now();
    const planned = await planDictionaryChange(this.dictionaries, this.specIds, suggestion, now);
    if (!planned.ok) return err(planned.error);
    const { stamp } = planned.value;

    const approved = suggestion.approve(input.by.id, now, this.ids.next(), stamp.number);
    if (!approved.ok) return err(approved.error);

    const rewrites: SpecIdRewrite[] = planned.value.rewrites.map(({ record: held, after }) => {
      const before = held.savedSpecId;
      const revised = before.revise({ specId: after, name: before.name, dictionaryRelease: CURRENT_RELEASE, by: input.by.id, at: now });
      // The name is the one it was saved with, so it passes again.
      if (!revised.ok) throw revised.error;
      return {
        saved: revised.value,
        change: SpecIdChange.updated(before, revised.value, this.ids.next(), stamp.number),
        expectedVersion: before.version,
      };
    });

    const applied = await this.store.apply({
      basedOn: planned.value.dictionary.change?.number ?? null,
      dictionary: planned.value.next,
      change: { number: stamp.number, suggestionId: suggestion.id, approvedBy: input.by.id, approvedAt: now },
      suggestion: approved.value,
      suggestionVersion: input.version,
      rewrites,
    });
    if (!applied.ok) return err(applied.error);

    const stored = await this.suggestions.findById(suggestion.id);
    if (!stored) throw new Error(`Suggestion ${suggestion.id} vanished`);
    return ok({ suggestion: toSuggestionDto(stored), changeNumber: stamp.number, specIdsRewritten: rewrites.length });
  }
}
