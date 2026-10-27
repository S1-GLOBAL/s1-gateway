import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { checkName } from '../domain/saved-spec-id.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import {
  InvalidSpecIdError,
  SpecIdChangedError,
  SpecIdExistsError,
  SpecIdNotFoundError,
  type SpecIdIssues,
} from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { DictionaryMovedOnError } from '../domain/suggestions/suggestion.errors.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { SavedSpecIdDto, UpdateSpecIdInput } from './atlas.dto.js';
import { savedSpecIdDtoOf } from './stage-counts.js';

export type UpdateSpecIdError = InvalidSpecIdError | SpecIdNotFoundError | SpecIdChangedError | SpecIdExistsError;

/**
 * Changes a saved Spec ID's facts or name (ADR 0022). Its code follows the
 * facts; the change is recorded; a change started from an older version, or
 * one that would give it another saved Spec ID's code, is refused.
 */
export class UpdateSpecId implements UseCase<UpdateSpecIdInput, Result<SavedSpecIdDto, UpdateSpecIdError>> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: UpdateSpecIdInput): Promise<Result<SavedSpecIdDto, UpdateSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const current = await this.specIds.findById(input.id);
    if (!current) return err(new SpecIdNotFoundError('id'));

    // The name and the slots are checked together, so the page shows every problem at once.
    const built = SpecId.build(input.facts, dictionary);
    const nameIssues = checkName(input.name);
    if (!built.ok || nameIssues.length > 0) {
      const issues: SpecIdIssues = built.ok ? {} : { ...built.error.issues };
      if (nameIssues.length > 0) issues.name = nameIssues;
      return err(new InvalidSpecIdError(issues));
    }

    const revised = current.savedSpecId.revise({
      specId: built.value,
      name: input.name,
      dictionaryRelease: dictionary.release,
      by: input.updatedBy.id,
      at: this.clock.now(),
    });
    if (!revised.ok) return revised;
    const change = SpecIdChange.updated(current.savedSpecId, revised.value, this.ids.next());

    // Nothing to change: answer what is saved, and record nothing.
    if (change.isEmpty) return ok(await savedSpecIdDtoOf(this.sourcing, current, dictionary));

    if (input.version !== current.savedSpecId.version) return err(new SpecIdChangedError());

    const code = built.value.code;
    const other = await this.specIds.findByCode(code);
    if (other && other.savedSpecId.id !== input.id) {
      return err(new SpecIdExistsError(await savedSpecIdDtoOf(this.sourcing, other, dictionary)));
    }

    // The database decides between simultaneous changes: the version, and the unique code.
    const updated = await this.specIds.update(revised.value, change, input.version, dictionary.change?.number ?? null);
    if (!updated.ok) {
      // An approval changed the dictionary meanwhile (ADR 0031): check the facts again against the one it left.
      if (updated.error instanceof DictionaryMovedOnError) return this.execute(input);
      if (updated.error instanceof SpecIdChangedError) return err(updated.error);
      const winner = await this.specIds.findByCode(code);
      return err(winner ? new SpecIdExistsError(await savedSpecIdDtoOf(this.sourcing, winner, dictionary)) : updated.error);
    }

    return ok(
      await savedSpecIdDtoOf(
        this.sourcing,
        { savedSpecId: revised.value, savedByName: current.savedByName, updatedByName: input.updatedBy.fullName },
        dictionary,
      ),
    );
  }
}
