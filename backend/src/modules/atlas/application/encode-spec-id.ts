import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { toDecodedSpecIdDto, type DecodedSpecIdDto, type EncodeSpecIdInput } from './atlas.dto.js';

/** Builds a Spec ID from facts and reads it back. Nothing is saved. */
export class EncodeSpecId implements UseCase<EncodeSpecIdInput, Result<DecodedSpecIdDto, InvalidSpecIdError>> {
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async execute(input: EncodeSpecIdInput): Promise<Result<DecodedSpecIdDto, InvalidSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const built = SpecId.build(input.facts, dictionary);
    if (!built.ok) return built;
    return ok(toDecodedSpecIdDto(built.value, dictionary));
  }
}
