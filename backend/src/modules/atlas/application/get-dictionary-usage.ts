import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { isDictionarySlot, isOptionCode, normaliseCode } from '../domain/suggestions/proposal.js';
import { InvalidSuggestionError } from '../domain/suggestions/suggestion.errors.js';
import { suggestionMessages } from '../domain/suggestions/suggestion.messages.js';
import type { DictionaryUsageInput } from './suggestion.dto.js';

/** How many saved Spec IDs hold an option, for the suggestion form's "Used by N saved Spec IDs" (#95). */
export class GetDictionaryUsage implements UseCase<DictionaryUsageInput, Result<number, InvalidSuggestionError>> {
  constructor(private readonly specIds: SpecIdRepository) {}

  async execute(input: DictionaryUsageInput): Promise<Result<number, InvalidSuggestionError>> {
    if (!isDictionarySlot(input.slot)) return err(new InvalidSuggestionError({ slot: [suggestionMessages.notAList()] }));
    const code = normaliseCode(input.code);
    // A marker is no option, and a capacity is matched by prefix: only a code an option could have is counted.
    if (!isOptionCode(input.slot, code)) return ok(0);
    return ok(await this.specIds.usageOf(input.slot, code));
  }
}
