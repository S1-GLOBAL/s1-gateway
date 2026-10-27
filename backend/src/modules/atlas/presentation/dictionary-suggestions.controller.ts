import type { Request, Response } from 'express';
import type {
  DictionaryChangeApproved,
  DictionaryCount,
  DictionarySuggestion,
  DictionarySuggestionDetail,
} from '../../../contracts/atlas.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { ApproveDictionarySuggestionError } from '../application/approve-dictionary-suggestion.js';
import type { EditDictionarySuggestionError } from '../application/edit-dictionary-suggestion.js';
import type { RejectDictionarySuggestionError } from '../application/reject-dictionary-suggestion.js';
import type {
  ApproveDictionarySuggestionInput,
  ApprovedSuggestionDto,
  Asker,
  CountWaitingSuggestionsInput,
  DictionaryUsageInput,
  EditDictionarySuggestionInput,
  ListDictionarySuggestionsInput,
  RejectDictionarySuggestionInput,
  SuggestDictionaryChangeInput,
  SuggestionDetailDto,
  SuggestionDto,
  SuggestionIdInput,
  WithdrawDictionarySuggestionInput,
} from '../application/suggestion.dto.js';
import type { WithdrawDictionarySuggestionError } from '../application/withdraw-dictionary-suggestion.js';
import type { Proposal } from '../domain/suggestions/proposal.js';
import {
  SuggestionNotFoundError,
  type InvalidSuggestionError,
} from '../domain/suggestions/suggestion.errors.js';
import {
  approveDictionarySuggestionRequestSchema,
  editDictionarySuggestionRequestSchema,
  rejectDictionarySuggestionRequestSchema,
  suggestDictionaryChangeRequestSchema,
  suggestionIdSchema,
  suggestionListStateSchema,
} from './atlas.schemas.js';

type SuggestionErrorCode =
  | EditDictionarySuggestionError['code']
  | WithdrawDictionarySuggestionError['code']
  | ApproveDictionarySuggestionError['code']
  | RejectDictionarySuggestionError['code'];

const STATUS_BY_CODE: Record<SuggestionErrorCode, number> = {
  VALIDATION_FAILED: 400,
  SUGGESTION_NOT_FOUND: 404,
  NOT_ALLOWED: 403,
  SUGGESTION_DECIDED: 409,
  SUGGESTION_CHANGED: 409,
  SUGGESTION_OUT_OF_DATE: 409,
  SPEC_IDS_WOULD_CLASH: 409,
  SPEC_ID_WOULD_BE_INVALID: 409,
  DICTIONARY_CHANGED: 409,
  SPEC_ID_CHANGED: 409,
};

/** The use cases behind the suggestion routes (#95). */
export interface DictionarySuggestionUseCases {
  suggest: UseCase<SuggestDictionaryChangeInput, Result<SuggestionDto, InvalidSuggestionError>>;
  edit: UseCase<EditDictionarySuggestionInput, Result<SuggestionDto, EditDictionarySuggestionError>>;
  withdraw: UseCase<WithdrawDictionarySuggestionInput, Result<SuggestionDto, WithdrawDictionarySuggestionError>>;
  list: UseCase<ListDictionarySuggestionsInput, SuggestionDto[]>;
  get: UseCase<SuggestionIdInput, Result<SuggestionDetailDto, SuggestionNotFoundError>>;
  countWaiting: UseCase<CountWaitingSuggestionsInput, number>;
  usage: UseCase<DictionaryUsageInput, Result<number, InvalidSuggestionError>>;
  approve: UseCase<ApproveDictionarySuggestionInput, Result<ApprovedSuggestionDto, ApproveDictionarySuggestionError>>;
  reject: UseCase<RejectDictionarySuggestionInput, Result<SuggestionDto, RejectDictionarySuggestionError>>;
}

/** The signed-in account a request comes from, and whether it is an admin. */
export type SignedInAsker = (req: Request) => Asker;

/** Translates HTTP into the suggestion use cases and their results back into HTTP. No business rules here. */
export class DictionarySuggestionsController {
  constructor(
    private readonly useCases: DictionarySuggestionUseCases,
    private readonly asker: SignedInAsker,
  ) {}

  suggest = async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(suggestDictionaryChangeRequestSchema, req.body);
    const result = await this.useCases.suggest.execute({
      target: { slot: body.slot, code: body.code },
      // The schema checked the shape; whether every rule is there is the domain's call.
      proposal: body.proposal as Proposal,
      by: this.asker(req),
    });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: DictionarySuggestion = result.value;
    sendData(res, 201, suggestion);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const suggestions: DictionarySuggestion[] = await this.useCases.list.execute({
      state: suggestionListStateSchema.parse(req.query.state),
    });
    sendData(res, 200, suggestions);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const result = await this.useCases.get.execute({ id: suggestionIdOf(req) });
    if (!result.ok) throw toHttpError(result.error);
    const detail: DictionarySuggestionDetail = result.value;
    sendData(res, 200, detail);
  };

  edit = async (req: Request, res: Response): Promise<void> => {
    const id = suggestionIdOf(req);
    const body = parseBody(editDictionarySuggestionRequestSchema, req.body);
    const result = await this.useCases.edit.execute({
      id,
      target: { slot: body.slot, code: body.code },
      proposal: body.proposal as Proposal,
      version: body.version,
      by: this.asker(req),
    });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: DictionarySuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  withdraw = async (req: Request, res: Response): Promise<void> => {
    const result = await this.useCases.withdraw.execute({ id: suggestionIdOf(req), by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: DictionarySuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  /** Admins only: the route is mounted behind the admin gate. */
  approve = async (req: Request, res: Response): Promise<void> => {
    const id = suggestionIdOf(req);
    const { version } = parseBody(approveDictionarySuggestionRequestSchema, req.body);
    const result = await this.useCases.approve.execute({ id, version, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const approved: DictionaryChangeApproved = result.value;
    sendData(res, 200, approved);
  };

  /** Admins only: the route is mounted behind the admin gate. */
  reject = async (req: Request, res: Response): Promise<void> => {
    const id = suggestionIdOf(req);
    const { reason } = parseBody(rejectDictionarySuggestionRequestSchema, req.body);
    const result = await this.useCases.reject.execute({ id, reason, by: this.asker(req) });
    if (!result.ok) throw toHttpError(result.error);
    const suggestion: DictionarySuggestion = result.value;
    sendData(res, 200, suggestion);
  };

  waitingCount = async (req: Request, res: Response): Promise<void> => {
    const count: DictionaryCount = { count: await this.useCases.countWaiting.execute({ by: this.asker(req) }) };
    sendData(res, 200, count);
  };

  usage = async (req: Request, res: Response): Promise<void> => {
    const result = await this.useCases.usage.execute({ slot: String(req.params.slot), code: String(req.params.code) });
    if (!result.ok) throw toHttpError(result.error);
    const count: DictionaryCount = { count: result.value };
    sendData(res, 200, count);
  };
}

/** The `:id` of a suggestion route. Anything that is not an id names no suggestion: 404, before any query. */
function suggestionIdOf(req: Request): string {
  const parsed = suggestionIdSchema.safeParse(req.params.id);
  if (!parsed.success) throw toHttpError(new SuggestionNotFoundError());
  return parsed.data;
}

function toHttpError(error: { code: SuggestionErrorCode; message: string; details?: Record<string, unknown> | undefined }) {
  return new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
}
