import type { Manufacturer } from '../domain/sourcing/manufacturer.js';
import type { QuoteValues } from '../domain/sourcing/quote.js';
import type { QuoteProposalInput, QuoteSuggestionEventKind, QuoteSuggestionState } from '../domain/sourcing/quote-suggestion.js';
import type {
  QuoteSuggestionEventRecord,
  QuoteSuggestionListFilter,
  QuoteSuggestionRecord,
} from '../domain/sourcing/quote-suggestion-repository.js';
import type { StaffDto } from './atlas.dto.js';
import type { Asker } from './suggestion.dto.js';

/** A quotation's manufacturer: one already in Atlas, with its name, or a new one as named. */
export type SuggestedManufacturerDto =
  | { kind: 'existing'; id: string; name: string; country: string | null }
  | { kind: 'new'; name: string; country: string | null };

/** A quotation as the application hands it outward (ADR 0035). Dates are ISO 8601. */
export interface QuoteSuggestionDto {
  id: string;
  specId: string;
  specName: string;
  specCode: string;
  manufacturer: SuggestedManufacturerDto;
  values: QuoteValues;
  state: QuoteSuggestionState;
  version: number;
  suggestedBy: StaffDto;
  suggestedAt: string;
  decidedBy: StaffDto | null;
  decidedAt: string | null;
  reason: string | null;
  quoteId: string | null;
}

/** What a step of the trail asked for: an existing manufacturer by id, a new one by name. */
export interface QuoteProposalDto {
  manufacturer: { kind: 'existing'; id: string } | { kind: 'new'; name: string; country: string | null };
  values: QuoteValues;
}

export interface QuoteSuggestionEventDto {
  kind: QuoteSuggestionEventKind;
  by: StaffDto;
  at: string;
  proposalBefore: QuoteProposalDto | null;
  proposalAfter: QuoteProposalDto | null;
  reason: string | null;
}

/** A quotation with every step of its trail, the first first. */
export interface QuoteSuggestionDetailDto extends QuoteSuggestionDto {
  trail: QuoteSuggestionEventDto[];
}

/** A manufacturer to choose for a quotation. */
export interface ManufacturerDto {
  id: string;
  name: string;
  country: string | null;
}

export interface SuggestQuoteInput {
  specId: string;
  proposal: QuoteProposalInput;
  by: Asker;
}

export interface EditQuoteSuggestionInput {
  id: string;
  proposal: QuoteProposalInput;
  /** The version its suggester edited from. */
  version: number;
  by: Asker;
}

export interface QuoteSuggestionIdInput {
  id: string;
}

export interface ApproveQuoteSuggestionInput {
  id: string;
  /** The version the approver read. */
  version: number;
  by: Asker;
}

export interface RejectQuoteSuggestionInput {
  id: string;
  reason: string;
  by: Asker;
}

export interface WithdrawQuoteSuggestionInput {
  id: string;
  by: Asker;
}

export interface ListQuoteSuggestionsInput {
  state: QuoteSuggestionListFilter;
  /** One Spec ID's; all when left out. */
  specId?: string;
}

export interface CountWaitingQuoteSuggestionsInput {
  by: Asker;
}

export function toQuoteSuggestionDto(record: QuoteSuggestionRecord): QuoteSuggestionDto {
  const { suggestion } = record;
  const { manufacturer } = suggestion.proposal;
  return {
    id: suggestion.id,
    specId: suggestion.specId,
    specName: record.specName,
    specCode: record.specCode,
    manufacturer:
      manufacturer.kind === 'existing'
        ? { kind: 'existing', id: manufacturer.id, name: record.manufacturerName, country: record.manufacturerCountry }
        : { kind: 'new', name: manufacturer.name, country: manufacturer.country },
    values: suggestion.proposal.values,
    state: suggestion.state,
    version: suggestion.version,
    suggestedBy: { id: suggestion.suggestedBy, fullName: record.suggestedByName },
    suggestedAt: suggestion.suggestedAt.toISOString(),
    decidedBy: suggestion.decidedBy === null ? null : { id: suggestion.decidedBy, fullName: record.decidedByName ?? '' },
    decidedAt: suggestion.decidedAt?.toISOString() ?? null,
    reason: suggestion.reason,
    quoteId: suggestion.quoteId,
  };
}

export function toQuoteSuggestionEventDto(record: QuoteSuggestionEventRecord): QuoteSuggestionEventDto {
  const { event } = record;
  return {
    kind: event.kind,
    by: { id: event.by, fullName: record.byName },
    at: event.at.toISOString(),
    proposalBefore: event.proposalBefore,
    proposalAfter: event.proposalAfter,
    reason: event.reason,
  };
}

export function toManufacturerDto(manufacturer: Manufacturer): ManufacturerDto {
  return { id: manufacturer.id, name: manufacturer.name, country: manufacturer.country };
}
