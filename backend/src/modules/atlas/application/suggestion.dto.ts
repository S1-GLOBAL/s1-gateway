import type { Proposal, SuggestionKind, SuggestionTarget } from '../domain/suggestions/proposal.js';
import type { SuggestionEventRecord, SuggestionListFilter, SuggestionRecord } from '../domain/suggestions/suggestion-repository.js';
import type { SuggestionEventKind, SuggestionState } from '../domain/suggestions/suggestion.js';
import type { StaffDto } from './atlas.dto.js';

/** A dictionary suggestion as the application hands it outward (#95). Dates are ISO 8601. */
export interface SuggestionDto {
  id: string;
  kind: SuggestionKind;
  slot: SuggestionTarget['slot'];
  code: string;
  proposal: Proposal;
  state: SuggestionState;
  version: number;
  suggestedBy: StaffDto;
  suggestedAt: string;
  decidedBy: StaffDto | null;
  decidedAt: string | null;
  reason: string | null;
  changeNumber: number | null;
}

export interface SuggestionEventDto {
  kind: SuggestionEventKind;
  by: StaffDto;
  at: string;
  proposalBefore: Proposal | null;
  proposalAfter: Proposal | null;
  reason: string | null;
}

/** A saved Spec ID approving would rewrite, with its code now and after. */
export interface RewritePreviewDto {
  id: string;
  name: string;
  codeBefore: string;
  codeAfter: string;
}

/**
 * One suggestion with its whole trail, and how many saved Spec IDs hold its
 * option today. While it waits, also what approving it now would rewrite, or
 * why approving it now would be refused; both null once decided.
 */
export interface SuggestionDetailDto extends SuggestionDto {
  events: SuggestionEventDto[];
  usage: number;
  rewrites: RewritePreviewDto[] | null;
  problem: string | null;
}

/** An approved suggestion, the change it became, and how many saved Spec IDs it rewrote. */
export interface ApprovedSuggestionDto {
  suggestion: SuggestionDto;
  changeNumber: number;
  specIdsRewritten: number;
}

/** Who is asking: the signed-in account. */
export interface Asker {
  id: string;
  isAdmin: boolean;
}

export interface SuggestDictionaryChangeInput {
  target: SuggestionTarget;
  proposal: Proposal;
  by: Asker;
}

export interface EditDictionarySuggestionInput {
  id: string;
  target: SuggestionTarget;
  proposal: Proposal;
  /** The version the suggester edited from. */
  version: number;
  by: Asker;
}

export interface SuggestionIdInput {
  id: string;
}

export interface ApproveDictionarySuggestionInput {
  id: string;
  /** The version the approver read. */
  version: number;
  by: Asker;
}

export interface RejectDictionarySuggestionInput {
  id: string;
  reason: string;
  by: Asker;
}

export interface WithdrawDictionarySuggestionInput {
  id: string;
  by: Asker;
}

export interface ListDictionarySuggestionsInput {
  state: SuggestionListFilter;
}

export interface CountWaitingSuggestionsInput {
  by: Asker;
}

export interface DictionaryUsageInput {
  slot: string;
  code: string;
}

export function toSuggestionDto(record: SuggestionRecord): SuggestionDto {
  const { suggestion } = record;
  return {
    id: suggestion.id,
    kind: suggestion.kind,
    slot: suggestion.target.slot,
    code: suggestion.target.code,
    proposal: suggestion.proposal,
    state: suggestion.state,
    version: suggestion.version,
    suggestedBy: { id: suggestion.suggestedBy, fullName: record.suggestedByName },
    suggestedAt: suggestion.suggestedAt.toISOString(),
    decidedBy:
      suggestion.decidedBy === null ? null : { id: suggestion.decidedBy, fullName: record.decidedByName ?? '' },
    decidedAt: suggestion.decidedAt?.toISOString() ?? null,
    reason: suggestion.reason,
    changeNumber: suggestion.changeNumber,
  };
}

export function toSuggestionEventDto(record: SuggestionEventRecord): SuggestionEventDto {
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
