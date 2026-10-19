import type { Request, Response } from 'express';
import type {
  AtlasDictionary,
  DecodedSpecId,
  SavedSpecId,
  SimilarSpecIds,
  SpecIdChange,
  SpecIdLibraryPage,
  SpecIdLookup,
  SpecIdTextReading,
} from '../../../contracts/atlas.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type {
  DecodedSpecIdDto,
  DecodeSpecIdInput,
  DictionaryDto,
  EncodeSpecIdInput,
  FindSimilarSpecIdsInput,
  FindSpecIdByCodeInput,
  ListSavedSpecIdsInput,
  ReadSpecIdTextInput,
  SaveSpecIdInput,
  SavedSpecIdDto,
  SavedSpecIdIdInput,
  SimilarSpecIdsDto,
  SpecIdChangeDto,
  SpecIdLibraryPageDto,
  SpecIdLookupDto,
  SpecIdTextReadingDto,
  UpdateSpecIdInput,
} from '../application/atlas.dto.js';
import {
  SpecIdNotFoundError,
  type InvalidLookupError,
  type InvalidSpecIdError,
  type SpecIdChangedError,
  type SpecIdExistsError,
} from '../domain/spec-id.errors.js';
import {
  decodeSpecIdRequestSchema,
  encodeSpecIdRequestSchema,
  readSpecIdTextRequestSchema,
  saveSpecIdRequestSchema,
  savedSpecIdIdSchema,
  updateSpecIdRequestSchema,
} from './atlas.schemas.js';

type SpecIdResult = Result<DecodedSpecIdDto, InvalidSpecIdError>;
type SaveResult = Result<SavedSpecIdDto, InvalidSpecIdError | SpecIdExistsError>;
type FindResult = Result<SpecIdLookupDto, SpecIdNotFoundError>;
type SimilarResult = Result<SimilarSpecIdsDto, InvalidLookupError>;
type GetResult = Result<SavedSpecIdDto, SpecIdNotFoundError>;
type UpdateResult = Result<
  SavedSpecIdDto,
  InvalidSpecIdError | SpecIdNotFoundError | SpecIdChangedError | SpecIdExistsError
>;
type HistoryResult = Result<SpecIdChangeDto[], SpecIdNotFoundError>;
type LibraryResult = Result<SpecIdLibraryPageDto, InvalidLookupError>;
type ReadResult = Result<SpecIdTextReadingDto, InvalidLookupError | InvalidSpecIdError>;

type AtlasErrorCode =
  | InvalidSpecIdError['code']
  | SpecIdExistsError['code']
  | SpecIdNotFoundError['code']
  | SpecIdChangedError['code']
  | InvalidLookupError['code'];

const STATUS_BY_CODE: Record<AtlasErrorCode, number> = {
  INVALID_SPEC_ID: 400,
  SPEC_ID_EXISTS: 409,
  SPEC_ID_NOT_FOUND: 404,
  SPEC_ID_CHANGED: 409,
  VALIDATION_FAILED: 400,
};

/** The use cases behind the saved Spec ID routes: one by id, a change, its history, the library. */
export interface SavedSpecIdUseCases {
  getSaved: UseCase<SavedSpecIdIdInput, GetResult>;
  update: UseCase<UpdateSpecIdInput, UpdateResult>;
  history: UseCase<SavedSpecIdIdInput, HistoryResult>;
  library: UseCase<ListSavedSpecIdsInput, LibraryResult>;
}

/** The signed-in staff member a request comes from: who a saved Spec ID is saved by. */
export type SignedInStaff = (req: Request) => { id: string; fullName: string };

/** Translates HTTP into use-case calls and results back into HTTP. No business rules here. */
export class AtlasController {
  constructor(
    private readonly getDictionary: UseCase<void, DictionaryDto>,
    private readonly decodeSpecId: UseCase<DecodeSpecIdInput, SpecIdResult>,
    private readonly encodeSpecId: UseCase<EncodeSpecIdInput, SpecIdResult>,
    private readonly saveSpecId: UseCase<SaveSpecIdInput, SaveResult>,
    private readonly findSpecIdByCode: UseCase<FindSpecIdByCodeInput, FindResult>,
    private readonly findSimilarSpecIds: UseCase<FindSimilarSpecIdsInput, SimilarResult>,
    private readonly signedInStaff: SignedInStaff,
    private readonly saved: SavedSpecIdUseCases,
    private readonly readSpecIdText: UseCase<ReadSpecIdTextInput, ReadResult>,
  ) {}

  dictionary = async (_req: Request, res: Response): Promise<void> => {
    const dictionary: AtlasDictionary = await this.getDictionary.execute();
    sendData(res, 200, dictionary);
  };

  decode = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(decodeSpecIdRequestSchema, req.body);
    sendDecoded(res, await this.decodeSpecId.execute(input));
  };

  encode = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(encodeSpecIdRequestSchema, req.body);
    sendDecoded(res, await this.encodeSpecId.execute(input));
  };

  readText = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(readSpecIdTextRequestSchema, req.body);
    const result = await this.readSpecIdText.execute(input);
    if (!result.ok) throw toHttpError(result.error);
    const reading: SpecIdTextReading = result.value;
    sendData(res, 200, reading);
  };

  save = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(saveSpecIdRequestSchema, req.body);
    const result = await this.saveSpecId.execute({ ...input, savedBy: this.signedInStaff(req) });
    if (!result.ok) throw toHttpError(result.error);
    const saved: SavedSpecId = result.value;
    sendData(res, 201, saved);
  };

  findByCode = async (req: Request, res: Response): Promise<void> => {
    const result = await this.findSpecIdByCode.execute({ code: String(req.params.code) });
    if (!result.ok) throw toHttpError(result.error);
    const lookup: SpecIdLookup = result.value;
    sendData(res, 200, lookup);
  };

  library = async (req: Request, res: Response): Promise<void> => {
    const result = await this.saved.library.execute({ ...req.query });
    if (!result.ok) throw toHttpError(result.error);
    const page: SpecIdLibraryPage = result.value;
    sendData(res, 200, page);
  };

  getSaved = async (req: Request, res: Response): Promise<void> => {
    const result = await this.saved.getSaved.execute({ id: savedSpecIdOf(req) });
    if (!result.ok) throw toHttpError(result.error);
    const saved: SavedSpecId = result.value;
    sendData(res, 200, saved);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = savedSpecIdOf(req);
    const input = parseBody(updateSpecIdRequestSchema, req.body);
    const result = await this.saved.update.execute({ ...input, id, updatedBy: this.signedInStaff(req) });
    if (!result.ok) throw toHttpError(result.error);
    const saved: SavedSpecId = result.value;
    sendData(res, 200, saved);
  };

  history = async (req: Request, res: Response): Promise<void> => {
    const result = await this.saved.history.execute({ id: savedSpecIdOf(req) });
    if (!result.ok) throw toHttpError(result.error);
    const history: SpecIdChange[] = result.value;
    sendData(res, 200, history);
  };

  findSimilar = async (req: Request, res: Response): Promise<void> => {
    const result = await this.findSimilarSpecIds.execute({ ...req.query });
    if (!result.ok) throw toHttpError(result.error);
    const similar: SimilarSpecIds = result.value;
    sendData(res, 200, similar);
  };
}

function sendDecoded(res: Response, result: SpecIdResult): void {
  if (!result.ok) throw toHttpError(result.error);
  const decoded: DecodedSpecId = result.value;
  sendData(res, 200, decoded);
}

/** The `:id` of a saved Spec ID route. Anything that is not an id names no Spec ID: 404, before any query. */
function savedSpecIdOf(req: Request): string {
  const parsed = savedSpecIdIdSchema.safeParse(req.params.id);
  if (!parsed.success) throw toHttpError(new SpecIdNotFoundError('id'));
  return parsed.data;
}

function toHttpError(error: { code: AtlasErrorCode; message: string; details?: Record<string, unknown> | undefined }) {
  return new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
}
