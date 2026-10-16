import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { toSavedSpecIdDto, type FindSpecIdByCodeInput, type SavedSpecIdDto } from './atlas.dto.js';

/** Opens one saved Spec ID by its exact code. */
export class FindSpecIdByCode
  implements UseCase<FindSpecIdByCodeInput, Result<SavedSpecIdDto, SpecIdNotFoundError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: FindSpecIdByCodeInput): Promise<Result<SavedSpecIdDto, SpecIdNotFoundError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const record = await this.specIds.findByCode(input.code.trim());
    if (!record) return err(new SpecIdNotFoundError());
    return ok(toSavedSpecIdDto(record, dictionary));
  }
}
