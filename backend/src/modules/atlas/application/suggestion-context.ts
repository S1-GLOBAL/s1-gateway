import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import {
  isDictionarySlot,
  isOptionCode,
  normaliseCode,
  type ProposalContext,
  type SuggestionTarget,
} from '../domain/suggestions/proposal.js';

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
  // A new option has no number yet, and a capacity is matched by prefix: only a key an option could have is counted.
  const code = normaliseCode(target.code);
  const usage = isDictionarySlot(target.slot) && isOptionCode(target.slot, code) ? await specIds.usageOf(target.slot, code) : 0;
  return { dictionary, usage };
}
