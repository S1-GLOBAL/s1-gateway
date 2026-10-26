import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { diffCodes } from '../domain/diff-codes.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { SpecId } from '../domain/spec-id.js';
import type { SpecIdChangeRecord, SpecIdRepository } from '../domain/spec-id-repository.js';
import type { SavedSpecIdIdInput, SlotChangeDto, SpecIdChangeDto } from './atlas.dto.js';

/**
 * A saved Spec ID's history, newest first, each change read slot by slot.
 * The page never decodes: every slot comes with its meaning before and after.
 */
export class GetSpecIdHistory implements UseCase<SavedSpecIdIdInput, Result<SpecIdChangeDto[], SpecIdNotFoundError>> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: SavedSpecIdIdInput): Promise<Result<SpecIdChangeDto[], SpecIdNotFoundError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    if (!(await this.specIds.findById(input.id))) return err(new SpecIdNotFoundError('id'));
    const records = await this.specIds.history(input.id);
    return ok(records.map((record) => toSpecIdChangeDto(record, dictionary)));
  }
}

function toSpecIdChangeDto(
  { change, changedByName, dictionaryChange }: SpecIdChangeRecord,
  dictionary: Dictionary,
): SpecIdChangeDto {
  return {
    kind: change.kind,
    changedBy: { id: change.changedBy, fullName: changedByName },
    changedAt: change.changedAt.toISOString(),
    codeBefore: change.codeBefore,
    codeAfter: change.codeAfter,
    nameBefore: change.nameBefore,
    nameAfter: change.nameAfter,
    slots: change.codeBefore === null ? [] : slotChanges(change.codeBefore, change.codeAfter, dictionary),
    dictionaryChange: dictionaryChange ?? null,
  };
}

/**
 * Today's dictionary reads both codes. A code an approved change renamed or
 * deleted since reads as its letters, and a reworded one in today's words
 * (ADR 0031).
 */
function slotChanges(codeBefore: string, codeAfter: string, dictionary: Dictionary): SlotChangeDto[] {
  const before = SpecId.restoreCode(codeBefore);
  const after = SpecId.restoreCode(codeAfter);
  const meaningsBefore = new Map(before.describe(dictionary).map((slot) => [slot.key, slot]));
  const meaningsAfter = new Map(after.describe(dictionary).map((slot) => [slot.key, slot.meaning]));
  return diffCodes(before, after).map((difference) => ({
    key: difference.key,
    name: meaningsBefore.get(difference.key)?.name ?? difference.key,
    before: meaningsBefore.get(difference.key)?.meaning ?? difference.before,
    after: meaningsAfter.get(difference.key) ?? difference.after,
    corrected: difference.corrected,
  }));
}
