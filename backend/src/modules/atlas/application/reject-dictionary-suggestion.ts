import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { checkReason } from '../domain/suggestions/proposal.js';
import {
  SuggestionNotFoundError,
  type InvalidSuggestionError,
  type OwnSuggestionError,
  type SuggestionChangedError,
  type SuggestionDecidedError,
} from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { toSuggestionDto, type RejectDictionarySuggestionInput, type SuggestionDto } from './suggestion.dto.js';

export type RejectDictionarySuggestionError =
  | SuggestionNotFoundError
  | OwnSuggestionError
  | SuggestionDecidedError
  | SuggestionChangedError
  | InvalidSuggestionError;

/**
 * An admin who did not suggest it rejects a waiting suggestion, saying why
 * (#95). The reason is shown to the suggester and kept in the trail; nothing
 * in the dictionary changes.
 */
export class RejectDictionarySuggestion
  implements UseCase<RejectDictionarySuggestionInput, Result<SuggestionDto, RejectDictionarySuggestionError>>
{
  constructor(
    private readonly suggestions: SuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RejectDictionarySuggestionInput): Promise<Result<SuggestionDto, RejectDictionarySuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.decisionRefusalFor(input.by.id);
    if (refused) return err(refused);

    const reason = checkReason(input.reason, record.suggestedByName);
    if (!reason.ok) return err(reason.error);

    const rejected = suggestion.reject(input.by.id, reason.value, this.clock.now(), this.ids.next());
    if (!rejected.ok) return err(rejected.error);
    const saved = await this.suggestions.save(rejected.value, suggestion.version);
    if (!saved.ok) return err(saved.error);

    const stored = await this.suggestions.findById(suggestion.id);
    if (!stored) throw new Error(`Suggestion ${suggestion.id} vanished`);
    return ok(toSuggestionDto(stored));
  }
}
