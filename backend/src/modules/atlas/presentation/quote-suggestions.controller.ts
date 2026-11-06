import type { Request, Response } from 'express';
import type { DictionaryCount, ManufacturerSummary, QuoteSuggestion, QuoteSuggestionDetail } from '../../../contracts/atlas.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type {
  ApproveQuoteSuggestionError,
  EditQuoteSuggestionError,
  RejectQuoteSuggestionError,
  WithdrawQuoteSuggestionError,
} from '../application/quote-suggestion-steps.js';
import type {
  ApproveQuoteSuggestionInput,
  CountWaitingQuoteSuggestionsInput,
  EditQuoteSuggestionInput,
  ListQuoteSuggestionsInput,
  ManufacturerDto,
  QuoteSuggestionDetailDto,
  QuoteSuggestionDto,
  QuoteSuggestionIdInput,
  RejectQuoteSuggestionInput,
  SuggestQuoteInput,
  WithdrawQuoteSuggestionInput,
} from '../application/quote-suggestion.dto.js';
import type { Asker } from '../application/suggestion.dto.js';
import { QuoteSuggestionNotFoundError, type InvalidQuoteSuggestionError } from '../domain/sourcing/quote-suggestion.errors.js';
import {
  approveQuoteSuggestionRequestSchema,
  editQuoteSuggestionRequestSchema,
  quoteSuggestionIdSchema,
  quoteSuggestionListStateSchema,
  quoteSuggestionSpecIdSchema,
  rejectQuoteSuggestionRequestSchema,
  suggestQuoteRequestSchema,
} from './quote-suggestions.schemas.js';

type QuoteSuggestionErrorCode =
  | InvalidQuoteSuggestionError['code']
  | QuoteSuggestionNotFoundError['code']
  | EditQuoteSuggestionError['code']
  | WithdrawQuoteSuggestionError['code']
  | ApproveQuoteSuggestionError['code']
  | RejectQuoteSuggestionError['code'];

const STATUS_BY_CODE: Record<QuoteSuggestionErrorCode, number> = {
  VALIDATION_FAILED: 400,
  QUOTE_SUGGESTION_NOT_FOUND: 404,
  NOT_ALLOWED: 403,
  QUOTE_SUGGESTION_DECIDED: 409,
  QUOTE_SUGGESTION_CHANGED: 409,
};

/** The use cases behind the quotation routes (plan 0017). */
export interface QuoteSuggestionUseCases {
  suggest: UseCase<SuggestQuoteInput, Result<QuoteSuggestionDto, InvalidQuoteSuggestionError>>;
  edit: UseCase<EditQuoteSuggestionInput, Result<QuoteSuggestionDto, EditQuoteSuggestionError>>;
  withdraw: UseCase<WithdrawQuoteSuggestionInput, Result<QuoteSuggestionDto, WithdrawQuoteSuggestionError>>;
  list: UseCase<ListQuoteSuggestionsInput, QuoteSuggestionDto[]>;
  get: UseCase<QuoteSuggestionIdInput, Result<QuoteSuggestionDetailDto, QuoteSuggestionNotFoundError>>;
  countWaiting: UseCase<CountWaitingQuoteSuggestionsInput, number>;
  approve: UseCase<ApproveQuoteSuggestionInput, Result<QuoteSuggestionDto, ApproveQuoteSuggestionError>>;
  reject: UseCase<RejectQuoteSuggestionInput, Result<QuoteSuggestionDto, RejectQuoteSuggestionError>>;
  manufacturers: UseCase<void, ManufacturerDto[]>;
}

/** Translates HTTP into the quotation use cases and their results back into HTTP. No business rules here. */
export class QuoteSuggestionsController {
  constructor(
    private readonly useCases: QuoteSuggestionUseCases,
    private readonly asker: (req: Request) => Asker,
  ) {}

  suggest = async (req: Request, res: Response): Promise<void> => {
    const { specId, ...proposal } = parseBody(suggestQuoteRequestSchema, req.body);
    const result = await this.useCases.suggest.execute({ specId, proposal, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: QuoteSuggestion = result.value;
    sendData(res, 201, suggestion);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const specId = quoteSuggestionSpecIdSchema.parse(req.query.specId);
    const suggestions: QuoteSuggestion[] = await this.useCases.list.execute({
      state: quoteSuggestionListStateSchema.parse(req.query.state),
      ...(specId === undefined ? {} : { specId }),
    });
    sendData(res, 200, suggestions);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const result = await this.useCases.get.execute({ id: idOf(req) });
    if (!result.ok) throw toHttpError(result.error);
    const detail: QuoteSuggestionDetail = result.value;
    sendData(res, 200, detail);
  };

  edit = async (req: Request, res: Response): Promise<void> => {
    const id = idOf(req);
    const { version, ...proposal } = parseBody(editQuoteSuggestionRequestSchema, req.body);
    const result = await this.useCases.edit.execute({ id, proposal, version, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: QuoteSuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  withdraw = async (req: Request, res: Response): Promise<void> => {
    const result = await this.useCases.withdraw.execute({ id: idOf(req), by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: QuoteSuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  /** Admins only: the route is mounted behind the admin gate. */
  approve = async (req: Request, res: Response): Promise<void> => {
    const id = idOf(req);
    const { version } = parseBody(approveQuoteSuggestionRequestSchema, req.body);
    const result = await this.useCases.approve.execute({ id, version, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: QuoteSuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  /** Admins only: the route is mounted behind the admin gate. */
  reject = async (req: Request, res: Response): Promise<void> => {
    const id = idOf(req);
    const { reason } = parseBody(rejectQuoteSuggestionRequestSchema, req.body);
    const result = await this.useCases.reject.execute({ id, reason, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: QuoteSuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  waitingCount = async (req: Request, res: Response): Promise<void> => {
    const count: DictionaryCount = { count: await this.useCases.countWaiting.execute({ by: this.asker(req) }) };
    sendData(res, 200, count);
  };

  manufacturers = async (_req: Request, res: Response): Promise<void> => {
    const manufacturers: ManufacturerSummary[] = await this.useCases.manufacturers.execute();
    sendData(res, 200, manufacturers);
  };
}

/** The `:id` of a quotation route. Anything that is not an id names no quotation: 404, before any query. */
function idOf(req: Request): string {
  const parsed = quoteSuggestionIdSchema.safeParse(req.params.id);
  if (!parsed.success) throw toHttpError(new QuoteSuggestionNotFoundError());
  return parsed.data;
}

function toHttpError(error: { code: QuoteSuggestionErrorCode; message: string; details?: Record<string, unknown> | undefined }) {
  return new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
}
