import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { shortForm } from '../domain/old-codes.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { liveCode } from '../domain/spec-id.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import {
  toFormerHolderDto,
  type FindSpecIdByCodeInput,
  type SpecIdLookupDto,
} from './atlas.dto.js';
import { savedSpecIdDtoOf } from './stage-counts.js';

/**
 * Opens a saved Spec ID by a code: the one that has it now, with every Spec ID
 * that had it before; or, when none has it now, the last one that did. Codes
 * are written in capitals, so a code typed in lower case is found too, and a
 * code given out before, S1 or long, is looked up as the short code it converts to (ADR 0025).
 * A code no Spec ID has or had is looked up once more in the dictionary's live
 * letters, so one written before an approved rename finds what it is now (ADR 0031).
 */
export class FindSpecIdByCode
  implements UseCase<FindSpecIdByCodeInput, Result<SpecIdLookupDto, SpecIdNotFoundError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
  ) {}

  async execute(input: FindSpecIdByCodeInput): Promise<Result<SpecIdLookupDto, SpecIdNotFoundError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const typed = input.code.trim().toUpperCase();
    const code = shortForm(typed);
    const holder = await this.specIds.findByCode(code);
    const former = (await this.specIds.formerHolders(code)).filter(
      ({ record }) => record.savedSpecId.id !== holder?.savedSpecId.id,
    );

    if (holder) {
      return ok({
        ...(await savedSpecIdDtoOf(this.sourcing, holder, dictionary)),
        replacedCode: null,
        formerHolders: former.map(toFormerHolderDto),
      });
    }
    const [latest, ...others] = former;
    if (!latest) {
      const now = liveCode(code, dictionary);
      const renamed = now === code ? null : await this.specIds.findByCode(now);
      if (!renamed) return err(new SpecIdNotFoundError());
      return ok({
        ...(await savedSpecIdDtoOf(this.sourcing, renamed, dictionary)),
        replacedCode: code,
        formerHolders: [],
      });
    }
    return ok({
      ...(await savedSpecIdDtoOf(this.sourcing, latest.record, dictionary)),
      replacedCode: code,
      formerHolders: others.map(toFormerHolderDto),
    });
  }
}
