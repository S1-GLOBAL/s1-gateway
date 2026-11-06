import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import {
  QuoteSuggestionChangedError,
  QuoteSuggestionNotFoundError,
  type InvalidQuoteSuggestionError,
  type OwnQuoteSuggestionError,
  type QuoteSuggestionDecidedError,
  type QuoteSuggestionNotAllowedError,
} from '../domain/sourcing/quote-suggestion.errors.js';
import type { QuoteSuggestionRepository } from '../domain/sourcing/quote-suggestion-repository.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import { checkReason } from '../domain/suggestions/proposal.js';
import type { InvalidSuggestionError } from '../domain/suggestions/suggestion.errors.js';
import {
  toQuoteSuggestionDto,
  toQuoteSuggestionEventDto,
  type ApproveQuoteSuggestionInput,
  type CountWaitingQuoteSuggestionsInput,
  type EditQuoteSuggestionInput,
  type ListQuoteSuggestionsInput,
  type QuoteSuggestionDetailDto,
  type QuoteSuggestionDto,
  type QuoteSuggestionIdInput,
  type RejectQuoteSuggestionInput,
  type WithdrawQuoteSuggestionInput,
} from './quote-suggestion.dto.js';
import { checkedProposal } from './suggest-quote.js';

/*
 * The steps of a quotation after it is added (ADR 0035): its suggester edits
 * or withdraws it while it waits; an admin who did not add it approves or
 * rejects it; anyone signed in reads them. Each step saves from the version
 * read, so two people never decide over each other.
 */

/** Reads the quotation as it now is, after a step. */
async function reread(suggestions: QuoteSuggestionRepository, id: string): Promise<QuoteSuggestionDto> {
  const stored = await suggestions.findById(id);
  if (!stored) throw new Error(`Quotation ${id} vanished`);
  return toQuoteSuggestionDto(stored);
}

export type EditQuoteSuggestionError =
  | QuoteSuggestionNotFoundError
  | QuoteSuggestionNotAllowedError
  | QuoteSuggestionDecidedError
  | QuoteSuggestionChangedError
  | InvalidQuoteSuggestionError;

/** Its suggester replaces what a waiting quotation asks for, from the version they read. */
export class EditQuoteSuggestion implements UseCase<EditQuoteSuggestionInput, Result<QuoteSuggestionDto, EditQuoteSuggestionError>> {
  constructor(
    private readonly sourcing: SourcingRepository,
    private readonly suggestions: QuoteSuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditQuoteSuggestionInput): Promise<Result<QuoteSuggestionDto, EditQuoteSuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new QuoteSuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.refusalFor(input.by.id);
    if (refused) return err(refused);
    if (suggestion.version !== input.version) return err(new QuoteSuggestionChangedError());

    const proposal = await checkedProposal(input.proposal, this.sourcing);
    if (!proposal.ok) return proposal;
    const edited = suggestion.edit(input.by.id, proposal.value, this.clock.now(), this.ids.next());
    if (!edited.ok) return edited;
    const saved = await this.suggestions.save(edited.value, input.version);
    if (!saved.ok) return saved;
    return ok(await reread(this.suggestions, suggestion.id));
  }
}

export type WithdrawQuoteSuggestionError =
  | QuoteSuggestionNotFoundError
  | QuoteSuggestionNotAllowedError
  | QuoteSuggestionDecidedError
  | QuoteSuggestionChangedError;

/** Its suggester takes back a waiting quotation. */
export class WithdrawQuoteSuggestion
  implements UseCase<WithdrawQuoteSuggestionInput, Result<QuoteSuggestionDto, WithdrawQuoteSuggestionError>>
{
  constructor(
    private readonly suggestions: QuoteSuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: WithdrawQuoteSuggestionInput): Promise<Result<QuoteSuggestionDto, WithdrawQuoteSuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new QuoteSuggestionNotFoundError());
    const { suggestion } = record;
    const withdrawn = suggestion.withdraw(input.by.id, this.clock.now(), this.ids.next());
    if (!withdrawn.ok) return withdrawn;
    const saved = await this.suggestions.save(withdrawn.value, suggestion.version);
    if (!saved.ok) return saved;
    return ok(await reread(this.suggestions, suggestion.id));
  }
}

export type ApproveQuoteSuggestionError =
  | QuoteSuggestionNotFoundError
  | OwnQuoteSuggestionError
  | QuoteSuggestionDecidedError
  | QuoteSuggestionChangedError;

/**
 * An admin who did not add it approves a quotation, from the version they
 * read. Its quote is recorded on the Spec ID, and a new manufacturer found or
 * added by name, together with the decision, or none of them.
 */
export class ApproveQuoteSuggestion
  implements UseCase<ApproveQuoteSuggestionInput, Result<QuoteSuggestionDto, ApproveQuoteSuggestionError>>
{
  constructor(
    private readonly suggestions: QuoteSuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ApproveQuoteSuggestionInput): Promise<Result<QuoteSuggestionDto, ApproveQuoteSuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new QuoteSuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.decisionRefusalFor(input.by.id);
    if (refused) return err(refused);
    if (suggestion.version !== input.version) return err(new QuoteSuggestionChangedError());

    const at = this.clock.now();
    const quoteId = this.ids.next();
    const approved = suggestion.approve(input.by.id, at, this.ids.next(), quoteId);
    if (!approved.ok) return approved;
    const saved = await this.suggestions.approve(approved.value, input.version, { quoteId, newManufacturerId: this.ids.next(), at });
    if (!saved.ok) return saved;
    return ok(await reread(this.suggestions, suggestion.id));
  }
}

export type RejectQuoteSuggestionError =
  | QuoteSuggestionNotFoundError
  | OwnQuoteSuggestionError
  | QuoteSuggestionDecidedError
  | QuoteSuggestionChangedError
  | InvalidSuggestionError;

/** An admin who did not add it rejects a waiting quotation, saying why. The reason is kept in its trail. */
export class RejectQuoteSuggestion
  implements UseCase<RejectQuoteSuggestionInput, Result<QuoteSuggestionDto, RejectQuoteSuggestionError>>
{
  constructor(
    private readonly suggestions: QuoteSuggestionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RejectQuoteSuggestionInput): Promise<Result<QuoteSuggestionDto, RejectQuoteSuggestionError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new QuoteSuggestionNotFoundError());
    const { suggestion } = record;
    const refused = suggestion.decisionRefusalFor(input.by.id);
    if (refused) return err(refused);
    const reason = checkReason(input.reason, record.suggestedByName);
    if (!reason.ok) return reason;

    const rejected = suggestion.reject(input.by.id, reason.value, this.clock.now(), this.ids.next());
    if (!rejected.ok) return rejected;
    const saved = await this.suggestions.save(rejected.value, suggestion.version);
    if (!saved.ok) return saved;
    return ok(await reread(this.suggestions, suggestion.id));
  }
}

/** The quotations waiting, the oldest first, or those decided, the latest first; all, or one Spec ID's. */
export class ListQuoteSuggestions implements UseCase<ListQuoteSuggestionsInput, QuoteSuggestionDto[]> {
  constructor(private readonly suggestions: QuoteSuggestionRepository) {}

  async execute(input: ListQuoteSuggestionsInput): Promise<QuoteSuggestionDto[]> {
    return (await this.suggestions.list(input.state, input.specId)).map(toQuoteSuggestionDto);
  }
}

/** One quotation with its trail. */
export class GetQuoteSuggestion implements UseCase<QuoteSuggestionIdInput, Result<QuoteSuggestionDetailDto, QuoteSuggestionNotFoundError>> {
  constructor(private readonly suggestions: QuoteSuggestionRepository) {}

  async execute(input: QuoteSuggestionIdInput): Promise<Result<QuoteSuggestionDetailDto, QuoteSuggestionNotFoundError>> {
    const record = await this.suggestions.findById(input.id);
    if (!record) return err(new QuoteSuggestionNotFoundError());
    const trail = (await this.suggestions.events(input.id)).map(toQuoteSuggestionEventDto);
    return ok({ ...toQuoteSuggestionDto(record), trail });
  }
}

/** How many quotations wait for the asker to decide: those they did not add. */
export class CountWaitingQuoteSuggestions implements UseCase<CountWaitingQuoteSuggestionsInput, number> {
  constructor(private readonly suggestions: QuoteSuggestionRepository) {}

  async execute(input: CountWaitingQuoteSuggestionsInput): Promise<number> {
    return this.suggestions.countWaitingNotSuggestedBy(input.by.id);
  }
}
