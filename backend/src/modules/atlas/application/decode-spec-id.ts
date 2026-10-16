import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { toDecodedSpecIdDto, type DecodedSpecIdDto, type DecodeSpecIdInput } from './atlas.dto.js';

export class DecodeSpecId implements UseCase<DecodeSpecIdInput, Result<DecodedSpecIdDto, InvalidSpecIdError>> {
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async execute(input: DecodeSpecIdInput): Promise<Result<DecodedSpecIdDto, InvalidSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const parsed = SpecId.parse(input.code, dictionary);
    if (!parsed.ok) return parsed;
    return ok(toDecodedSpecIdDto(parsed.value, dictionary));
  }
}
