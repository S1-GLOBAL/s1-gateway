import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { SuggestionNotFoundError } from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import {
  toSuggestionDto,
  toSuggestionEventDto,
  type SuggestionDetailDto,
  type SuggestionIdInput,
} from './suggestion.dto.js';

/** One suggestion with its whole trail, and how many saved Spec IDs hold its option today (#95). */
export class GetDictionarySuggestion
  implements UseCase<SuggestionIdInput, Result<SuggestionDetailDto, SuggestionNotFoundError>>
{
  constructor(
    private readonly suggestions: SuggestionRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: SuggestionIdInput): Promise<Result<SuggestionDetailDto, SuggestionNotFoundError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());
    const { slot, code } = record.suggestion.target;
    const [events, usage] = await Promise.all([this.suggestions.events(input.id), this.specIds.usageOf(slot, code)]);
    return ok({ ...toSuggestionDto(record), events: events.map(toSuggestionEventDto), usage });
  }
}
