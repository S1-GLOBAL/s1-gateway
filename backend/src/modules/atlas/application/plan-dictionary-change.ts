import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Dictionary, DictionaryChangeStamp } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { SavedSpecIdRecord, SpecIdRepository } from '../domain/spec-id-repository.js';
import type { SpecId } from '../domain/spec-id.js';
import { applyProposal, rewriteSpecId, rewritesSpecIds } from '../domain/suggestions/apply-proposal.js';
import type { OptionHolders } from '../domain/suggestions/dictionary-change-store.js';
import { checkProposal } from '../domain/suggestions/proposal.js';
import {
  SpecIdsWouldClashError,
  SpecIdWouldBeInvalidError,
  SuggestionOutOfDateError,
} from '../domain/suggestions/suggestion.errors.js';
import type { Suggestion } from '../domain/suggestions/suggestion.js';

/** A saved Spec ID an approval would rewrite, and its code after. */
export interface PlannedRewrite {
  readonly record: SavedSpecIdRecord;
  readonly after: SpecId;
}

/** What approving a suggestion now would do. */
export interface PlannedChange {
  /** The live dictionary the plan was made from. */
  readonly dictionary: Dictionary;
  readonly stamp: DictionaryChangeStamp;
  /** The dictionary the approval would leave. */
  readonly next: Dictionary;
  /** Every saved Spec ID holding the option, as read; null when the change rewrites none. */
  readonly holders: OptionHolders | null;
  /** Only the Spec IDs whose code would change. */
  readonly rewrites: readonly PlannedRewrite[];
}

export type PlanError = SuggestionOutOfDateError | SpecIdWouldBeInvalidError | SpecIdsWouldClashError;

/**
 * Plans approving `suggestion` at `at` (ADR 0031): checks it again against the
 * live dictionary, applies it as the next numbered change, and rewrites every
 * saved Spec ID holding its option. Refused when it no longer fits, when a
 * rewrite would be a code the new dictionary refuses, or when two Spec IDs
 * would end with one code. Approving writes the plan; a waiting suggestion's
 * page shows it.
 */
export async function planDictionaryChange(
  dictionaries: DictionaryRepository,
  specIds: SpecIdRepository,
  suggestion: Suggestion,
  at: Date,
): Promise<Result<PlannedChange, PlanError>> {
  const dictionary = await dictionaries.get(CURRENT_RELEASE);
  if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);
  const { slot, code } = suggestion.target;

  const checked = checkProposal(suggestion.target, suggestion.proposal, {
    dictionary,
    usage: await specIds.usageOf(slot, code),
  });
  if (!checked.ok) return err(new SuggestionOutOfDateError(checked.error.issues));

  const stamp = { number: (dictionary.change?.number ?? 0) + 1, at };
  const next = applyProposal(dictionary, checked.value.target, checked.value.proposal, stamp);
  if (!rewritesSpecIds(checked.value.proposal)) return ok({ dictionary, stamp, next, holders: null, rewrites: [] });

  const held = await specIds.holding(slot, code);
  const holders = {
    slot,
    code,
    specIds: held.map(({ savedSpecId }) => ({ id: savedSpecId.id, version: savedSpecId.version })),
  };
  const rewrites: PlannedRewrite[] = [];
  for (const record of held) {
    const before = record.savedSpecId.specId;
    const after = rewriteSpecId(before, checked.value.target, checked.value.proposal, next);
    if (!after.ok) {
      const problem = Object.values(after.error.issues).flat()[0] ?? after.error.message;
      return err(new SpecIdWouldBeInvalidError(before.code, problem));
    }
    if (after.value.code !== before.code) rewrites.push({ record, after: after.value });
  }

  const clash = await findClash(specIds, rewrites);
  if (clash) return err(new SpecIdsWouldClashError(clash));
  return ok({ dictionary, stamp, next, holders, rewrites });
}

/** Two codes, as they are now, of Spec IDs the rewrites would give one code; undefined when none would. */
async function findClash(
  specIds: SpecIdRepository,
  rewrites: readonly PlannedRewrite[],
): Promise<[string, string] | undefined> {
  const byNewCode = new Map<string, string>();
  const moving = new Set(rewrites.map(({ record }) => record.savedSpecId.id));
  for (const { record, after } of rewrites) {
    const before = record.savedSpecId.specId.code;
    const twin = byNewCode.get(after.code);
    if (twin !== undefined) return [twin, before];
    byNewCode.set(after.code, before);

    const holder = await specIds.findByCode(after.code);
    if (holder && !moving.has(holder.savedSpecId.id)) return [before, holder.savedSpecId.specId.code];
  }
  return undefined;
}
