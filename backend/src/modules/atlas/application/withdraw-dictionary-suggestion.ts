import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import {
  SuggestionNotFoundError,
  type SuggestionChangedError,
  type SuggestionDecidedError,
  type SuggestionNotAllowedError,
} from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { toSuggestionDto, type SuggestionDto, type WithdrawDictionarySuggestionInput } from './suggestion.dto.js';

export type WithdrawDictionarySuggestionError =
  | SuggestionNotFoundError
  | SuggestionNotAllowedError
  | SuggestionDecidedError
  | SuggestionChangedError;

/** The suggester takes back a waiting suggestion (#95). It stays in the history, withdrawn. */
export class WithdrawDictionarySuggestion
  implements UseCase<WithdrawDictionarySuggestionInput, Result<SuggestionDto, WithdrawDictionarySuggestionError>>
{
  constructor(
    private readonly suggestions: SuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: WithdrawDictionarySuggestionInput,
  ): Promise<Result<SuggestionDto, WithdrawDictionarySuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());

    const withdrawn = record.suggestion.withdraw(input.by.id, this.clock.now(), this.ids.next());
    if (!withdrawn.ok) return err(withdrawn.error);
    const saved = await this.suggestions.save(withdrawn.value, record.suggestion.version);
    if (!saved.ok) return err(saved.error);

    const stored = await this.suggestions.findById(input.id);
    if (!stored) throw new Error(`Suggestion ${input.id} vanished`);
    return ok(toSuggestionDto(stored));
  }
}
