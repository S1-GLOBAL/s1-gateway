import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { checkName, SavedSpecId } from '../domain/saved-spec-id.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { InvalidSpecIdError, SpecIdExistsError, type SpecIdIssues } from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { toSavedSpecIdDto, type SaveSpecIdInput, type SavedSpecIdDto } from './atlas.dto.js';

export type SaveSpecIdError = InvalidSpecIdError | SpecIdExistsError;

/** Builds a Spec ID from facts and saves it under a name. A code that is already saved is never saved twice. */
export class SaveSpecId implements UseCase<SaveSpecIdInput, Result<SavedSpecIdDto, SaveSpecIdError>> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveSpecIdInput): Promise<Result<SavedSpecIdDto, SaveSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    // The name and the slots are checked together, so the page shows every problem at once.
    const built = SpecId.build(input.facts, dictionary);
    const nameIssues = checkName(input.name);
    if (!built.ok || nameIssues.length > 0) {
      const issues: SpecIdIssues = built.ok ? {} : { ...built.error.issues };
      if (nameIssues.length > 0) issues.name = nameIssues;
      return err(new InvalidSpecIdError(issues));
    }

    const created = SavedSpecId.create({
      id: this.ids.next(),
      specId: built.value,
      name: input.name,
      dictionaryRelease: dictionary.release,
      savedBy: input.savedBy.id,
      savedAt: this.clock.now(),
    });
    if (!created.ok) return created;

    const code = built.value.code;
    const existing = await this.specIds.findByCode(code);
    if (existing) return err(new SpecIdExistsError(toSavedSpecIdDto(existing, dictionary)));

    // The database decides between two simultaneous saves of one code: the loser reads the winner.
    const added = await this.specIds.add(created.value, SpecIdChange.created(created.value, this.ids.next()));
    if (!added.ok) {
      const winner = await this.specIds.findByCode(code);
      return err(winner ? new SpecIdExistsError(toSavedSpecIdDto(winner, dictionary)) : added.error);
    }

    return ok(
      toSavedSpecIdDto(
        { savedSpecId: created.value, savedByName: input.savedBy.fullName, updatedByName: null },
        dictionary,
      ),
    );
  }
}
