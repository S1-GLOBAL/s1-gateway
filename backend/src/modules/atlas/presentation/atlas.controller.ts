import type { Request, Response } from 'express';
import type { AtlasDictionary, DecodedSpecId } from '../../../contracts/atlas.js';
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
} from '../application/atlas.dto.js';
import type { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { decodeSpecIdRequestSchema, encodeSpecIdRequestSchema } from './atlas.schemas.js';

type SpecIdResult = Result<DecodedSpecIdDto, InvalidSpecIdError>;

const STATUS_BY_CODE: Record<InvalidSpecIdError['code'], number> = {
  INVALID_SPEC_ID: 400,
};

/** Translates HTTP into use-case calls and results back into HTTP. No business rules here. */
export class AtlasController {
  constructor(
    private readonly getDictionary: UseCase<void, DictionaryDto>,
    private readonly decodeSpecId: UseCase<DecodeSpecIdInput, SpecIdResult>,
    private readonly encodeSpecId: UseCase<EncodeSpecIdInput, SpecIdResult>,
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
}

function sendDecoded(res: Response, result: SpecIdResult): void {
  if (!result.ok) {
    const { error } = result;
    throw new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
  }
  const decoded: DecodedSpecId = result.value;
  sendData(res, 200, decoded);
}
