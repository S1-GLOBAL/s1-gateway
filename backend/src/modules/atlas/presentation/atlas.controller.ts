import type { Request, Response } from 'express';
import type { AtlasDictionary, DecodedSpecId, SavedSpecId, SimilarSpecIds } from '../../../contracts/atlas.js';
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
  SaveSpecIdInput,
  SavedSpecIdDto,
  SimilarSpecIdsDto,
} from '../application/atlas.dto.js';
import type {
  InvalidLookupError,
  InvalidSpecIdError,
  SpecIdExistsError,
  SpecIdNotFoundError,
} from '../domain/spec-id.errors.js';
import { decodeSpecIdRequestSchema, encodeSpecIdRequestSchema, saveSpecIdRequestSchema } from './atlas.schemas.js';

type SpecIdResult = Result<DecodedSpecIdDto, InvalidSpecIdError>;
type SaveResult = Result<SavedSpecIdDto, InvalidSpecIdError | SpecIdExistsError>;
type FindResult = Result<SavedSpecIdDto, SpecIdNotFoundError>;
type SimilarResult = Result<SimilarSpecIdsDto, InvalidLookupError>;

type AtlasErrorCode =
  | InvalidSpecIdError['code']
  | SpecIdExistsError['code']
  | SpecIdNotFoundError['code']
  | InvalidLookupError['code'];

const STATUS_BY_CODE: Record<AtlasErrorCode, number> = {
  INVALID_SPEC_ID: 400,
  SPEC_ID_EXISTS: 409,
  SPEC_ID_NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
};

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
    const saved: SavedSpecId = result.value;
    sendData(res, 200, saved);
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

function toHttpError(error: { code: AtlasErrorCode; message: string; details?: Record<string, unknown> | undefined }) {
  return new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
}
