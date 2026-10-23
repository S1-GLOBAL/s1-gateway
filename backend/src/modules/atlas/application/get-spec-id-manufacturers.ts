import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { QuoteRecord, SourcingRepository, StageChangeRecord } from '../domain/sourcing/sourcing-repository.js';
import { stageOf } from '../domain/sourcing/stage.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import type { SavedSpecIdIdInput, SpecIdManufacturerDto, SpecIdManufacturersDto } from './atlas.dto.js';

/**
 * A saved Spec ID's manufacturers (#57): each once, by name, with its stage
 * and every quote the verified-list import recorded for it.
 */
export class GetSpecIdManufacturers implements UseCase<SavedSpecIdIdInput, Result<SpecIdManufacturersDto, SpecIdNotFoundError>> {
  constructor(
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
  ) {}

  async execute(input: SavedSpecIdIdInput): Promise<Result<SpecIdManufacturersDto, SpecIdNotFoundError>> {
    const record = await this.specIds.findById(input.id);
    if (!record) return err(new SpecIdNotFoundError('id'));
    const { savedSpecId } = record;
    return ok({
      specId: { id: savedSpecId.id, name: savedSpecId.name, code: savedSpecId.specId.code },
      manufacturers: await manufacturersOn(this.sourcing, savedSpecId.id),
    });
  }
}

/** Each manufacturer with a quote on the Spec ID, once, in the order its quotes come: by name. */
export async function manufacturersOn(sourcing: SourcingRepository, specId: string): Promise<SpecIdManufacturerDto[]> {
  const [quotes, stages] = await Promise.all([sourcing.quotesOf(specId), sourcing.currentStages(specId)]);
  const changes = new Map(stages.map((record) => [record.change.manufacturerId, record]));
  const byManufacturer = new Map<string, QuoteRecord[]>();
  for (const record of quotes) {
    byManufacturer.set(record.manufacturer.id, [...(byManufacturer.get(record.manufacturer.id) ?? []), record]);
  }
  return [...byManufacturer.values()].map((records) => toManufacturerDto(records, changes.get(records[0]?.manufacturer.id ?? '')));
}

function toManufacturerDto(records: readonly QuoteRecord[], set: StageChangeRecord | undefined): SpecIdManufacturerDto {
  const manufacturer = (records[0] as QuoteRecord).manufacturer;
  const values = records.map((record) => record.quote.values);
  return {
    id: manufacturer.id,
    name: manufacturer.name,
    country: manufacturer.country,
    stage: stageOf(values, set?.change.stageAfter ?? null),
    stageSet: set
      ? {
          by: { id: set.change.changedBy, fullName: set.changedByName },
          at: set.change.changedAt.toISOString(),
          stage: set.change.stageAfter,
        }
      : null,
    quotes: values.map((value) => ({ ...value })),
  };
}
