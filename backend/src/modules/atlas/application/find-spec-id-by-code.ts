import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { codeInToday } from '../domain/code.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
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
 * that had it before; or, when none has it now, the last one that did. A code
 * is looked up in today's spelling and standard order, whenever and however it
 * was written (ADR 0032): letters in any order and either case, or a dotted
 * code given out before, S1, long or short (ADR 0025), its options read in the
 * letters an approved change gave them (ADR 0031).
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

    const code = codeInToday(input.code, dictionary);
    if (code === null) return err(new SpecIdNotFoundError());
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
    if (!latest) return err(new SpecIdNotFoundError());
    return ok({
      ...(await savedSpecIdDtoOf(this.sourcing, latest.record, dictionary)),
      replacedCode: code,
      formerHolders: others.map(toFormerHolderDto),
    });
  }
}
