import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { NAME_MAX_LENGTH } from '../domain/saved-spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { InvalidLookupError } from '../domain/spec-id.errors.js';
import { checkSlotValue } from '../domain/spec-id.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { LibraryQuery, SpecIdRepository } from '../domain/spec-id-repository.js';
import { toSavedSpecIdDto, type ListSavedSpecIdsInput, type SpecIdLibraryPageDto } from './atlas.dto.js';
import { decodeLibraryCursor, encodeLibraryCursor } from './library-cursor.js';
import { stageCountsOf } from './stage-counts.js';

/** Twenty saved Spec IDs per page (#16). */
export const LIBRARY_PAGE_SIZE = 20;

const FILTERS = ['q', 'productType', 'cursor'] as const;

/** One page of the library: newest change first, optionally by name and product type. */
export class ListSavedSpecIds
  implements UseCase<ListSavedSpecIdsInput, Result<SpecIdLibraryPageDto, InvalidLookupError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
  ) {}

  async execute(input: ListSavedSpecIdsInput): Promise<Result<SpecIdLibraryPageDto, InvalidLookupError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const issues: Record<string, string[]> = {};
    const query: LibraryQuery = { limit: LIBRARY_PAGE_SIZE + 1 };
    for (const [key, value] of Object.entries(input)) {
      if (!(FILTERS as readonly string[]).includes(key)) {
        issues[key] = ['Not a filter of the library.'];
      } else if (typeof value !== 'string') {
        issues[key] = ['Choose one value.'];
      } else if (key === 'q') {
        const q = value.trim();
        if (q.length > NAME_MAX_LENGTH) issues.q = [`Search text must be at most ${NAME_MAX_LENGTH} characters.`];
        else if (q !== '') query.q = q;
      } else if (key === 'productType') {
        const problem = value === '' ? undefined : checkSlotValue('productType', value, dictionary);
        if (problem) issues.productType = [problem];
        else if (value !== '') query.productType = value;
      } else {
        const cursor = decodeLibraryCursor(value);
        if (cursor) query.after = cursor;
        else issues.cursor = ['Not a page of this list. Start again from the first page.'];
      }
    }
    if (Object.keys(issues).length > 0) return err(new InvalidLookupError(issues));

    // One more than a page says whether another page follows.
    const records = await this.specIds.list(query);
    const page = records.slice(0, LIBRARY_PAGE_SIZE);
    const last = page.at(-1);
    const counts = await stageCountsOf(this.sourcing, page.map((record) => record.savedSpecId.id));
    return ok({
      items: page.map((record) => toSavedSpecIdDto(record, dictionary, counts(record.savedSpecId.id))),
      nextCursor:
        records.length > LIBRARY_PAGE_SIZE && last
          ? encodeLibraryCursor({ lastChangedAt: last.savedSpecId.lastChangedAt, id: last.savedSpecId.id })
          : null,
    });
  }
}
