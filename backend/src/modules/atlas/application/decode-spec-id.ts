import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { isDottedCode } from '../domain/code.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { watchCode } from '../domain/watch-code.js';
import { toDecodedSpecIdDto, type DecodedSpecIdDto, type DecodeSpecIdInput } from './atlas.dto.js';

/**
 * Reads a code slot by slot. A code written today that does not read, often
 * one still being typed, is answered with what is wrong with each part so
 * far (ADR 0032); when no part is, with why the whole code is refused, such
 * as a missing product type. A dotted code given out before is answered slot
 * by slot.
 */
export class DecodeSpecId implements UseCase<DecodeSpecIdInput, Result<DecodedSpecIdDto, InvalidSpecIdError>> {
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async execute(input: DecodeSpecIdInput): Promise<Result<DecodedSpecIdDto, InvalidSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const parsed = SpecId.parse(input.code, dictionary);
    if (parsed.ok) return ok(toDecodedSpecIdDto(parsed.value, dictionary));
    if (isDottedCode(input.code)) return parsed;
    const { warnings } = watchCode(input.code, dictionary);
    return warnings.length > 0 ? err(new InvalidSpecIdError({ code: [...warnings] })) : parsed;
  }
}
