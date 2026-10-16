import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { classifyMatch, isSearchableSlot, type SimilarCriteria } from '../domain/similar-match.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { InvalidLookupError } from '../domain/spec-id.errors.js';
import { checkSlotValue } from '../domain/spec-id.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import {
  toSavedSpecIdDto,
  type FindSimilarSpecIdsInput,
  type SavedSpecIdDto,
  type SimilarSpecIdsDto,
} from './atlas.dto.js';

/** Finds saved Spec IDs by the slots chosen: those that fit, and those that might (a chosen slot is not known). */
export class FindSimilarSpecIds
  implements UseCase<FindSimilarSpecIdsInput, Result<SimilarSpecIdsDto, InvalidLookupError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: FindSimilarSpecIdsInput): Promise<Result<SimilarSpecIdsDto, InvalidLookupError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const issues: Record<string, string[]> = {};
    const criteria: SimilarCriteria = {};
    for (const [key, value] of Object.entries(input)) {
      if (!isSearchableSlot(key)) {
        issues[key] = ['Not a slot of an S1 Spec ID.'];
      } else if (typeof value !== 'string') {
        issues[key] = ['Choose one value.'];
      } else {
        const problem = checkSlotValue(key, value, dictionary);
        if (problem) issues[key] = [problem];
        else criteria[key] = value;
      }
    }
    if (Object.keys(issues).length > 0) return err(new InvalidLookupError(issues));

    const candidates = await this.specIds.findCandidates(criteria);
    const fits: SavedSpecIdDto[] = [];
    const mightFit: SavedSpecIdDto[] = [];
    for (const record of candidates) {
      const match = classifyMatch((key) => record.savedSpecId.specId.slot(key), criteria);
      if (match === 'fits') fits.push(toSavedSpecIdDto(record, dictionary));
      else if (match === 'might-fit') mightFit.push(toSavedSpecIdDto(record, dictionary));
    }
    return ok({ fits, mightFit });
  }
}
