import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import type { SavedSpecIdDto, SavedSpecIdIdInput } from './atlas.dto.js';
import { savedSpecIdDtoOf } from './stage-counts.js';

/** Opens one saved Spec ID by its permanent id. */
export class GetSavedSpecId implements UseCase<SavedSpecIdIdInput, Result<SavedSpecIdDto, SpecIdNotFoundError>> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
  ) {}

  async execute(input: SavedSpecIdIdInput): Promise<Result<SavedSpecIdDto, SpecIdNotFoundError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const record = await this.specIds.findById(input.id);
    if (!record) return err(new SpecIdNotFoundError('id'));
    return ok(await savedSpecIdDtoOf(this.sourcing, record, dictionary));
  }
}
