import type { Dictionary } from '../domain/dictionary.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import { reachedCounts, type ManufacturerStageCounts } from '../domain/sourcing/stage.js';
import type { SavedSpecIdRecord } from '../domain/spec-id-repository.js';
import { toSavedSpecIdDto, type SavedSpecIdDto } from './atlas.dto.js';

/**
 * The stage counts of every Spec ID in an answer, read in one go (#73): a
 * library page of 20 cards is one read, not 20. A Spec ID with no
 * manufacturers counts zeros.
 */
export async function stageCountsOf(
  sourcing: SourcingRepository,
  specIds: readonly string[],
): Promise<(specId: string) => ManufacturerStageCounts> {
  const stages = await sourcing.stagesOf([...new Set(specIds)]);
  return (specId) => reachedCounts(stages.get(specId) ?? []);
}

/** One saved Spec ID as the API answers it, with its stage counts read. */
export async function savedSpecIdDtoOf(
  sourcing: SourcingRepository,
  record: SavedSpecIdRecord,
  dictionary: Dictionary,
): Promise<SavedSpecIdDto> {
  const counts = await stageCountsOf(sourcing, [record.savedSpecId.id]);
  return toSavedSpecIdDto(record, dictionary, counts(record.savedSpecId.id));
}
