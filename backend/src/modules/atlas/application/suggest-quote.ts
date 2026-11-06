import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { checkQuoteProposal, QuoteSuggestion, type QuoteProposal, type QuoteProposalInput } from '../domain/sourcing/quote-suggestion.js';
import { InvalidQuoteSuggestionError } from '../domain/sourcing/quote-suggestion.errors.js';
import type { QuoteSuggestionRepository } from '../domain/sourcing/quote-suggestion-repository.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { toQuoteSuggestionDto, type QuoteSuggestionDto, type SuggestQuoteInput } from './quote-suggestion.dto.js';

/** A quotation checked: its values, and a chosen manufacturer that exists. */
export async function checkedProposal(
  input: QuoteProposalInput,
  sourcing: Pick<SourcingRepository, 'findManufacturer'>,
): Promise<Result<QuoteProposal, InvalidQuoteSuggestionError>> {
  const checked = checkQuoteProposal(input);
  if (!checked.ok) return checked;
  const { manufacturer } = checked.value;
  if (manufacturer.kind === 'existing' && (await sourcing.findManufacturer(manufacturer.id)) === null) {
    return err(new InvalidQuoteSuggestionError({ manufacturer: ['No manufacturer has this id. Choose one from the list, or name a new one.'] }));
  }
  return checked;
}

/**
 * Anyone signed in adds a quotation to a saved Spec ID (ADR 0035). It waits
 * for an admin: none of the Spec ID's quotes change until it is approved.
 */
export class SuggestQuote implements UseCase<SuggestQuoteInput, Result<QuoteSuggestionDto, InvalidQuoteSuggestionError>> {
  constructor(
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
    private readonly suggestions: QuoteSuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SuggestQuoteInput): Promise<Result<QuoteSuggestionDto, InvalidQuoteSuggestionError>> {
    if ((await this.specIds.findById(input.specId)) === null) {
      return err(new InvalidQuoteSuggestionError({ specId: ['No saved Spec ID has this id.'] }));
    }
    const proposal = await checkedProposal(input.proposal, this.sourcing);
    if (!proposal.ok) return proposal;

    const step = QuoteSuggestion.suggest({
      id: this.ids.next(),
      eventId: this.ids.next(),
      specId: input.specId,
      proposal: proposal.value,
      by: input.by.id,
      at: this.clock.now(),
    });
    await this.suggestions.add(step);
    const stored = await this.suggestions.findById(step.suggestion.id);
    if (!stored) throw new Error(`Quotation ${step.suggestion.id} vanished`);
    return ok(toQuoteSuggestionDto(stored));
  }
}
