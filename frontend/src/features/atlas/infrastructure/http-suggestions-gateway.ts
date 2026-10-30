import type {
  ApproveDictionarySuggestionRequest,
  DictionaryChangeApproved,
  DictionaryCount,
  DictionaryProposal,
  DictionarySuggestion,
  DictionarySuggestionDetail,
  DictionarySlotKey,
  DictionarySuggestionEvent,
  EditDictionarySuggestionRequest,
  RejectDictionarySuggestionRequest,
  SuggestDictionaryChangeRequest,
} from '@contracts/atlas';
import type { DataEnvelope } from '@contracts/envelope';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { SuggestionsGateway } from '../application/suggestions-gateway';
import type { SlotKey } from '../domain/atlas';
import type { ApprovedChange, Proposal, Suggestion, SuggestionDetail, SuggestionEvent, SuggestionInput } from '../domain/suggestion';

const BASE = '/atlas/dictionary/suggestions';

/** The SuggestionsGateway port over the HTTP API (#95). The only file in it that knows the wire format. */
export class HttpSuggestionsGateway implements SuggestionsGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async suggest(input: SuggestionInput): Promise<Suggestion> {
    try {
      const response = await this.http.post<DataEnvelope<DictionarySuggestion>>(BASE, toRequest(input));
      return toSuggestion(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async edit(id: string, input: SuggestionInput & { version: number }): Promise<Suggestion> {
    const body: EditDictionarySuggestionRequest = { ...toRequest(input), version: input.version };
    try {
      const response = await this.http.put<DataEnvelope<DictionarySuggestion>>(`${BASE}/${encodeURIComponent(id)}`, body);
      return toSuggestion(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async usage(slot: SlotKey, code: string): Promise<number> {
    try {
      const response = await this.http.get<DataEnvelope<DictionaryCount>>(
        `/atlas/dictionary/usage/${encodeURIComponent(slot)}/${encodeURIComponent(code)}`,
      );
      return response.data.data.count;
    } catch (error) {
      throw toAppError(error);
    }
  }

  async list(state: 'waiting' | 'decided'): Promise<Suggestion[]> {
    try {
      const response = await this.http.get<DataEnvelope<DictionarySuggestion[]>>(BASE, { params: { state } });
      return response.data.data.map(toSuggestion);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async get(id: string): Promise<SuggestionDetail> {
    try {
      const response = await this.http.get<DataEnvelope<DictionarySuggestionDetail>>(`${BASE}/${encodeURIComponent(id)}`);
      return toSuggestionDetail(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async waitingCount(): Promise<number> {
    try {
      const response = await this.http.get<DataEnvelope<DictionaryCount>>(`${BASE}/waiting-count`);
      return response.data.data.count;
    } catch (error) {
      throw toAppError(error);
    }
  }

  async approve(id: string, version: number): Promise<ApprovedChange> {
    const body: ApproveDictionarySuggestionRequest = { version };
    try {
      const response = await this.http.post<DataEnvelope<DictionaryChangeApproved>>(
        `${BASE}/${encodeURIComponent(id)}/approve`,
        body,
      );
      const { suggestion, changeNumber, specIdsRewritten } = response.data.data;
      return { suggestion: toSuggestion(suggestion), changeNumber, specIdsRewritten };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async reject(id: string, reason: string): Promise<Suggestion> {
    const body: RejectDictionarySuggestionRequest = { reason };
    try {
      const response = await this.http.post<DataEnvelope<DictionarySuggestion>>(`${BASE}/${encodeURIComponent(id)}/reject`, body);
      return toSuggestion(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async withdraw(id: string): Promise<Suggestion> {
    try {
      const response = await this.http.post<DataEnvelope<DictionarySuggestion>>(`${BASE}/${encodeURIComponent(id)}/withdraw`);
      return toSuggestion(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toRequest(input: SuggestionInput): SuggestDictionaryChangeRequest {
  // The form offers only the dictionary's own lists; the server refuses any other slot.
  return { slot: input.slot as DictionarySlotKey, code: input.code, proposal: fromProposal(input.proposal) };
}

function fromProposal(proposal: Proposal): DictionaryProposal {
  switch (proposal.kind) {
    case 'add':
      return {
        kind: 'add',
        meaning: proposal.meaning,
        searchWords: [...proposal.searchWords],
        rules: proposal.rules ? { ...proposal.rules } : null,
        ...(proposal.broader === undefined ? {} : { broader: proposal.broader }),
      };
    case 'edit':
      return {
        kind: 'edit',
        newCode: proposal.newCode,
        meaning: proposal.meaning,
        searchWords: proposal.searchWords ? [...proposal.searchWords] : null,
      };
    case 'delete':
      return { kind: 'delete', replacement: proposal.replacement };
    case 'rules':
      return { kind: 'rules', rules: { ...proposal.rules } };
  }
}

function toProposal(contract: DictionaryProposal): Proposal {
  switch (contract.kind) {
    case 'add':
      return {
        kind: 'add',
        meaning: contract.meaning,
        searchWords: [...contract.searchWords],
        rules: contract.rules ? { ...contract.rules } : null,
        ...(contract.broader == null ? {} : { broader: contract.broader }),
      };
    case 'edit':
      return {
        kind: 'edit',
        newCode: contract.newCode,
        meaning: contract.meaning,
        searchWords: contract.searchWords ? [...contract.searchWords] : null,
      };
    case 'delete':
      return { kind: 'delete', replacement: contract.replacement };
    case 'rules':
      return { kind: 'rules', rules: { ...contract.rules } };
  }
}

function toSuggestion(contract: DictionarySuggestion): Suggestion {
  return {
    id: contract.id,
    kind: contract.kind,
    slot: contract.slot,
    code: contract.code,
    proposal: toProposal(contract.proposal),
    state: contract.state,
    version: contract.version,
    suggestedBy: { id: contract.suggestedBy.id, fullName: contract.suggestedBy.fullName },
    suggestedAt: new Date(contract.suggestedAt),
    decidedBy: contract.decidedBy ? { id: contract.decidedBy.id, fullName: contract.decidedBy.fullName } : null,
    decidedAt: contract.decidedAt ? new Date(contract.decidedAt) : null,
    reason: contract.reason,
    changeNumber: contract.changeNumber,
  };
}

function toEvent(contract: DictionarySuggestionEvent): SuggestionEvent {
  return {
    kind: contract.kind,
    by: { id: contract.by.id, fullName: contract.by.fullName },
    at: new Date(contract.at),
    proposalBefore: contract.proposalBefore ? toProposal(contract.proposalBefore) : null,
    proposalAfter: contract.proposalAfter ? toProposal(contract.proposalAfter) : null,
    reason: contract.reason,
  };
}

function toSuggestionDetail(contract: DictionarySuggestionDetail): SuggestionDetail {
  return {
    ...toSuggestion(contract),
    events: contract.events.map(toEvent),
    usage: contract.usage,
    // An API older than plan 0010's phase 2 sends neither.
    rewrites: contract.rewrites?.map(({ id, name, codeBefore, codeAfter }) => ({ id, name, codeBefore, codeAfter })) ?? null,
    problem: contract.problem ?? null,
  };
}
