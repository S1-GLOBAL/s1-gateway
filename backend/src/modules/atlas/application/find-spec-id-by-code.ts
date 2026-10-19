import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { fromS1 } from '../domain/s1-code.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import {
  toFormerHolderDto,
  toSavedSpecIdDto,
  type FindSpecIdByCodeInput,
  type SpecIdLookupDto,
} from './atlas.dto.js';

/**
 * Opens a saved Spec ID by a code: the one that has it now, with every Spec ID
 * that had it before; or, when none has it now, the last one that did. Codes
 * are written in capitals, so a code typed in lower case is found too, and an
 * S1 code is looked up as the S2 code it converts to (ADR 0024).
 */
export class FindSpecIdByCode
  implements UseCase<FindSpecIdByCodeInput, Result<SpecIdLookupDto, SpecIdNotFoundError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: FindSpecIdByCodeInput): Promise<Result<SpecIdLookupDto, SpecIdNotFoundError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const typed = input.code.trim().toUpperCase();
    const code = fromS1(typed) ?? typed;
    const holder = await this.specIds.findByCode(code);
    const former = (await this.specIds.formerHolders(code)).filter(
      ({ record }) => record.savedSpecId.id !== holder?.savedSpecId.id,
    );

    if (holder) {
      return ok({ ...toSavedSpecIdDto(holder, dictionary), replacedCode: null, formerHolders: former.map(toFormerHolderDto) });
    }
    const [latest, ...others] = former;
    if (!latest) return err(new SpecIdNotFoundError());
    return ok({
      ...toSavedSpecIdDto(latest.record, dictionary),
      replacedCode: code,
      formerHolders: others.map(toFormerHolderDto),
    });
  }
}
