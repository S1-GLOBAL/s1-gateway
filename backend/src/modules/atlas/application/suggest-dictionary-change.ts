import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { checkProposal } from '../domain/suggestions/proposal.js';
import type { InvalidSuggestionError } from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { Suggestion } from '../domain/suggestions/suggestion.js';
import { proposalContext } from './suggestion-context.js';
import { toSuggestionDto, type SuggestDictionaryChangeInput, type SuggestionDto } from './suggestion.dto.js';

/**
 * Anyone signed in suggests a change to the dictionary (#95). It is checked
 * against the live dictionary and kept, with its first step in the trail;
 * nothing in the dictionary changes until an admin approves it.
 */
export class SuggestDictionaryChange
  implements UseCase<SuggestDictionaryChangeInput, Result<SuggestionDto, InvalidSuggestionError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly suggestions: SuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SuggestDictionaryChangeInput): Promise<Result<SuggestionDto, InvalidSuggestionError>> {
    const checked = checkProposal(
      input.target,
      input.proposal,
      await proposalContext(this.dictionaries, this.specIds, input.target),
    );
    if (!checked.ok) return err(checked.error);

    const step = Suggestion.suggest({
      id: this.ids.next(),
      eventId: this.ids.next(),
      target: checked.value.target,
      proposal: checked.value.proposal,
      by: input.by.id,
      at: this.clock.now(),
    });
    await this.suggestions.add(step);

    const stored = await this.suggestions.findById(step.suggestion.id);
    if (!stored) throw new Error(`Suggestion ${step.suggestion.id} was not stored`);
    return ok(toSuggestionDto(stored));
  }
}
