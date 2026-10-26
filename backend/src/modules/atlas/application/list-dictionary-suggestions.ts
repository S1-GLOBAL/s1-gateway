import type { UseCase } from '../../../shared/application/use-case.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { toSuggestionDto, type ListDictionarySuggestionsInput, type SuggestionDto } from './suggestion.dto.js';

/** Waiting or decided suggestions (#95). Every signed-in person sees every suggestion. */
export class ListDictionarySuggestions implements UseCase<ListDictionarySuggestionsInput, SuggestionDto[]> {
  constructor(private readonly suggestions: SuggestionRepository) {}

  async execute(input: ListDictionarySuggestionsInput): Promise<SuggestionDto[]> {
    return (await this.suggestions.list(input.state)).map(toSuggestionDto);
  }
}
