import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { SuggestionNotFoundError } from '../domain/suggestions/suggestion.errors.js';
import type { SuggestionRepository } from '../domain/suggestions/suggestion-repository.js';
import type { Suggestion } from '../domain/suggestions/suggestion.js';
import { planDictionaryChange } from './plan-dictionary-change.js';
import {
  toSuggestionDto,
  toSuggestionEventDto,
  type RewritePreviewDto,
  type SuggestionDetailDto,
  type SuggestionIdInput,
} from './suggestion.dto.js';

/**
 * One suggestion with its whole trail, and how many saved Spec IDs hold its
 * option today (#95). While it waits, also what approving it now would
 * rewrite, or why it would be refused, so the approver sees the scale first.
 */
export class GetDictionarySuggestion
  implements UseCase<SuggestionIdInput, Result<SuggestionDetailDto, SuggestionNotFoundError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly suggestions: SuggestionRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: SuggestionIdInput): Promise<Result<SuggestionDetailDto, SuggestionNotFoundError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new SuggestionNotFoundError());
    const { slot, code } = record.suggestion.target;
    const [events, usage, preview] = await Promise.all([
      this.suggestions.events(input.id),
      this.specIds.usageOf(slot, code),
      this.preview(record.suggestion),
    ]);
    return ok({ ...toSuggestionDto(record), events: events.map(toSuggestionEventDto), usage, ...preview });
  }

  private async preview(suggestion: Suggestion): Promise<{ rewrites: RewritePreviewDto[] | null; problem: string | null }> {
    if (suggestion.state !== 'waiting') return { rewrites: null, problem: null };
    const planned = await planDictionaryChange(this.dictionaries, this.specIds, suggestion, suggestion.suggestedAt);
    if (!planned.ok) return { rewrites: null, problem: planned.error.message };
    return {
      rewrites: planned.value.rewrites.map(({ record, after }) => ({
        id: record.savedSpecId.id,
        name: record.savedSpecId.name,
        codeBefore: record.savedSpecId.specId.code,
        codeAfter: after.code,
      })),
      problem: null,
    };
  }
}
