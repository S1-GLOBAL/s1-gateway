import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { checkProposal, normaliseCode } from '../domain/suggestions/proposal.js';
import {
  InvalidSuggestionError,
  SuggestionNotFoundError,
  type SuggestionChangedError,
  type SuggestionDecidedError,
  type SuggestionNotAllowedError,
} from '../domain/suggestions/suggestion.errors.js';
import { suggestionMessages } from '../domain/suggestions/suggestion.messages.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import { proposalContext } from './suggestion-context.js';
import { toSuggestionDto, type EditDictionarySuggestionInput, type SuggestionDto } from './suggestion.dto.js';

export type EditDictionarySuggestionError =
  | SuggestionNotFoundError
  | SuggestionNotAllowedError
  | SuggestionDecidedError
  | SuggestionChangedError
  | InvalidSuggestionError;

/**
 * The suggester replaces what a waiting suggestion asks for (#95). Its kind,
 * list and code stay; the edit is checked as a new suggestion is, raises its
 * version, and is kept in the trail with what it said before.
 */
export class EditDictionarySuggestion
  implements UseCase<EditDictionarySuggestionInput, Result<SuggestionDto, EditDictionarySuggestionError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly suggestions: SuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditDictionarySuggestionInput): Promise<Result<SuggestionDto, EditDictionarySuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.refusalFor(input.by.id);
    if (refused) return err(refused);

    const sameTarget =
      input.proposal.kind === suggestion.kind &&
      input.target.slot === suggestion.target.slot &&
      normaliseCode(input.target.code) === suggestion.target.code;
    if (!sameTarget) return err(new InvalidSuggestionError({ kind: [suggestionMessages.targetChanged()] }));

    const checked = checkProposal(
      suggestion.target,
      input.proposal,
      await proposalContext(this.dictionaries, this.specIds, suggestion.target),
    );
    if (!checked.ok) return err(checked.error);

    const edited = suggestion.edit(input.by.id, checked.value.proposal, this.clock.now(), this.ids.next());
    if (!edited.ok) return err(edited.error);
    const saved = await this.suggestions.save(edited.value, input.version);
    if (!saved.ok) return err(saved.error);

    const stored = await this.suggestions.findById(suggestion.id);
    if (!stored) throw new Error(`Suggestion ${suggestion.id} vanished`);
    return ok(toSuggestionDto(stored));
  }
}
