import type {
  ApproveQuoteSuggestionRequest,
  DictionaryCount,
  EditQuoteSuggestionRequest,
  ManufacturerSummary,
  QuoteSuggestion,
  QuoteSuggestionDetail,
  RejectQuoteSuggestionRequest,
  SuggestQuoteRequest,
} from '@contracts/atlas';
import type { DataEnvelope } from '@contracts/envelope';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { QuotationsGateway } from '../application/quotations-gateway';
import type { ManufacturerOption, Quotation, QuotationDetail, QuotationFields } from '../domain/quotation';

const BASE = '/atlas/quote-suggestions';

/** The QuotationsGateway port over the HTTP API (plan 0017). The only file in it that knows the wire format. */
export class HttpQuotationsGateway implements QuotationsGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async manufacturers(): Promise<ManufacturerOption[]> {
    return this.call(async () => (await this.http.get<DataEnvelope<ManufacturerSummary[]>>('/atlas/manufacturers')).data.data);
  }

  async add(specId: string, fields: QuotationFields): Promise<Quotation> {
    const body: SuggestQuoteRequest = { specId, ...fields };
    return this.call(async () => toQuotation((await this.http.post<DataEnvelope<QuoteSuggestion>>(BASE, body)).data.data));
  }

  async edit(id: string, fields: QuotationFields, version: number): Promise<Quotation> {
    const body: EditQuoteSuggestionRequest = { version, ...fields };
    return this.call(async () => toQuotation((await this.http.put<DataEnvelope<QuoteSuggestion>>(`${BASE}/${id}`, body)).data.data));
  }

  async list(state: 'waiting' | 'decided', specId?: string): Promise<Quotation[]> {
    const params = specId === undefined ? { state } : { state, specId };
    return this.call(async () => (await this.http.get<DataEnvelope<QuoteSuggestion[]>>(BASE, { params })).data.data.map(toQuotation));
  }

  async get(id: string): Promise<QuotationDetail> {
    return this.call(async () => {
      const detail = (await this.http.get<DataEnvelope<QuoteSuggestionDetail>>(`${BASE}/${id}`)).data.data;
      return {
        ...toQuotation(detail),
        trail: detail.trail.map((event) => ({ kind: event.kind, by: event.by, at: new Date(event.at), reason: event.reason })),
      };
    });
  }

  async waitingCount(): Promise<number> {
    return this.call(async () => (await this.http.get<DataEnvelope<DictionaryCount>>(`${BASE}/waiting-count`)).data.data.count);
  }

  async approve(id: string, version: number): Promise<Quotation> {
    const body: ApproveQuoteSuggestionRequest = { version };
    return this.call(async () => toQuotation((await this.http.post<DataEnvelope<QuoteSuggestion>>(`${BASE}/${id}/approve`, body)).data.data));
  }

  async reject(id: string, reason: string): Promise<Quotation> {
    const body: RejectQuoteSuggestionRequest = { reason };
    return this.call(async () => toQuotation((await this.http.post<DataEnvelope<QuoteSuggestion>>(`${BASE}/${id}/reject`, body)).data.data));
  }

  async withdraw(id: string): Promise<Quotation> {
    return this.call(async () => toQuotation((await this.http.post<DataEnvelope<QuoteSuggestion>>(`${BASE}/${id}/withdraw`)).data.data));
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toQuotation(quotation: QuoteSuggestion): Quotation {
  return {
    id: quotation.id,
    specId: quotation.specId,
    specName: quotation.specName,
    specCode: quotation.specCode,
    manufacturer: quotation.manufacturer,
    values: quotation.values,
    state: quotation.state,
    version: quotation.version,
    suggestedBy: quotation.suggestedBy,
    suggestedAt: new Date(quotation.suggestedAt),
    decidedBy: quotation.decidedBy,
    decidedAt: quotation.decidedAt === null ? null : new Date(quotation.decidedAt),
    reason: quotation.reason,
  };
}
