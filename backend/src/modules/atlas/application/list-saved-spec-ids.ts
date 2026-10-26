import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { NAME_MAX_LENGTH } from '../domain/saved-spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { InvalidLookupError } from '../domain/spec-id.errors.js';
import { checkSlotValue } from '../domain/spec-id.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { LibraryFilter, SpecIdRepository } from '../domain/spec-id-repository.js';
import { toSavedSpecIdDto, type ListSavedSpecIdsInput, type SpecIdLibraryPageDto } from './atlas.dto.js';
import { stageCountsOf } from './stage-counts.js';

/** Twenty saved Spec IDs per page. */
export const LIBRARY_PAGE_SIZE = 20;

const FILTERS = ['q', 'productType', 'page'] as const;

/** A page number is a whole number from 1, written without a leading zero, up to seven digits. */
function pageProblem(value: string): string | undefined {
  if (!/^[1-9]\d{0,6}$/.test(value)) return 'Page must be a whole number from 1.';
  return undefined;
}

/**
 * One page of the library: newest change first, optionally by name and product
 * type. `page` starts at 1. A page past the end is the last page, so one
 * request is enough (ADR 0029).
 */
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
    const filter: LibraryFilter = {};
    let requested = 1;
    for (const [key, value] of Object.entries(input)) {
      if (!(FILTERS as readonly string[]).includes(key)) {
        issues[key] = ['Not a filter of the library.'];
      } else if (typeof value !== 'string') {
        issues[key] = ['Choose one value.'];
      } else if (key === 'q') {
        const q = value.trim();
        if (q.length > NAME_MAX_LENGTH) issues.q = [`Search text must be at most ${NAME_MAX_LENGTH} characters.`];
        else if (q !== '') filter.q = q;
      } else if (key === 'productType') {
        const problem = value === '' ? undefined : checkSlotValue('productType', value, dictionary);
        if (problem) issues.productType = [problem];
        else if (value !== '') filter.productType = value;
      } else {
        const problem = pageProblem(value);
        if (problem) issues.page = [problem];
        else requested = Number(value);
      }
    }
    if (Object.keys(issues).length > 0) return err(new InvalidLookupError(issues));

    const total = await this.specIds.count(filter);
    const lastPage = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
    const page = Math.min(requested, lastPage);
    const records = await this.specIds.list({
      ...filter,
      limit: LIBRARY_PAGE_SIZE,
      offset: (page - 1) * LIBRARY_PAGE_SIZE,
    });
    const counts = await stageCountsOf(
      this.sourcing,
      records.map((record) => record.savedSpecId.id),
    );
    return ok({
      items: records.map((record) => toSavedSpecIdDto(record, dictionary, counts(record.savedSpecId.id))),
      page,
      pageSize: LIBRARY_PAGE_SIZE,
      total,
    });
  }
}
