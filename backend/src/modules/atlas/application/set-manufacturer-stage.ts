import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { ManufacturerNotFoundError } from '../domain/sourcing/sourcing.errors.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import type { SetManufacturerStageInput, SpecIdManufacturerDto } from './atlas.dto.js';
import { manufacturersOn } from './get-spec-id-manufacturers.js';

export type SetManufacturerStageError = SpecIdNotFoundError | ManufacturerNotFoundError;

/**
 * Sets a manufacturer's stage on a Spec ID to Sampling or In production, or
 * clears it, and records who, when, and the stage before and after (#57).
 * Only admins reach it: the route sits behind the admin gate. Setting the
 * stage it already has records nothing.
 */
export class SetManufacturerStage
  implements UseCase<SetManufacturerStageInput, Result<SpecIdManufacturerDto, SetManufacturerStageError>>
{
  constructor(
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SetManufacturerStageInput): Promise<Result<SpecIdManufacturerDto, SetManufacturerStageError>> {
    if (!(await this.specIds.findById(input.id))) return err(new SpecIdNotFoundError('id'));
    const quoted = (await this.sourcing.quotesOf(input.id)).some((record) => record.manufacturer.id === input.manufacturerId);
    if (!quoted) return err(new ManufacturerNotFoundError());

    await this.sourcing.recordStageChange({
      id: this.ids.next(),
      specId: input.id,
      manufacturerId: input.manufacturerId,
      stageAfter: input.stage,
      changedBy: input.by.id,
      changedAt: this.clock.now(),
    });
    const entry = (await manufacturersOn(this.sourcing, input.id)).find((manufacturer) => manufacturer.id === input.manufacturerId);
    if (!entry) return err(new ManufacturerNotFoundError());
    return ok(entry);
  }
}
