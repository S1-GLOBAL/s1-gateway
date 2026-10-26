import type { UseCase } from '../../../shared/application/use-case.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import type { CountWaitingSuggestionsInput } from './suggestion.dto.js';

/** Waiting suggestions the asker may decide, for the sidebar's badge: none for staff; for an admin, all but their own (#95). */
export class CountWaitingSuggestions implements UseCase<CountWaitingSuggestionsInput, number> {
  constructor(private readonly suggestions: SuggestionRepository) {}

  async execute(input: CountWaitingSuggestionsInput): Promise<number> {
    return input.by.isAdmin ? this.suggestions.countWaitingNotSuggestedBy(input.by.id) : 0;
  }
}
