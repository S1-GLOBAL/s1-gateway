import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import { isDictionarySlot, normaliseCode, type ProposalContext, type SuggestionTarget } from '../domain/suggestions/proposal.js';

/**
 * What a proposal for `target` is checked against: the live dictionary, with
 * its approved search words, and how many saved Spec IDs hold the option today.
 */
export async function proposalContext(
  dictionaries: DictionaryRepository,
  specIds: SpecIdRepository,
  target: SuggestionTarget,
): Promise<ProposalContext> {
  const dictionary = await dictionaries.get(CURRENT_RELEASE);
  if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);
  const usage = isDictionarySlot(target.slot) ? await specIds.usageOf(target.slot, normaliseCode(target.code)) : 0;
  return { dictionary, usage };
}
