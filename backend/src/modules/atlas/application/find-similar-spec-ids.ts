import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import {
  classifyMatch,
  isSearchableSlot,
  notKnownCount,
  recordedCount,
  type SearchableSlotKey,
  type SimilarCriteria,
} from '../domain/similar-match.js';
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

/**
 * Finds saved Spec IDs by the slots chosen: those that fit, the fewest slots
 * not known first; then those that might (a chosen slot is not known), the
 * most chosen slots recorded first. Ties stay newest first.
 */
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
        issues[key] = ['Not a slot of a Spec ID.'];
      } else if (typeof value !== 'string') {
        issues[key] = ['Choose one value.'];
      } else {
        const problem = checkSlotValue(key, value, dictionary);
        if (problem) issues[key] = [problem];
        else criteria[key] = value;
      }
    }
    if (Object.keys(issues).length > 0) return err(new InvalidLookupError(issues));

    // Candidates come newest first; each group is then ordered by closeness, and a
    // stable sort keeps a tie newest first (#50).
    const candidates = await this.specIds.findCandidates(criteria);
    const fits: { saved: SavedSpecIdDto; notKnown: number }[] = [];
    const mightFit: { saved: SavedSpecIdDto; recorded: number }[] = [];
    for (const record of candidates) {
      const slotOf = (key: SearchableSlotKey) => record.savedSpecId.specId.slot(key);
      const match = classifyMatch(slotOf, criteria);
      if (match === 'fits') fits.push({ saved: toSavedSpecIdDto(record, dictionary), notKnown: notKnownCount(slotOf) });
      else if (match === 'might-fit') {
        mightFit.push({ saved: toSavedSpecIdDto(record, dictionary), recorded: recordedCount(slotOf, criteria) });
      }
    }
    fits.sort((a, b) => a.notKnown - b.notKnown);
    mightFit.sort((a, b) => b.recorded - a.recorded);
    return ok({ fits: fits.map(({ saved }) => saved), mightFit: mightFit.map(({ saved }) => saved) });
  }
}
