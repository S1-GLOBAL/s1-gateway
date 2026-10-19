import type { DecodedSpecId, SimilarCriteria } from './atlas';

/** The slot the similar lookup never asks about: the variant is X on every code. */
const NOT_ASKED = new Set(['variant']);

/** The known slots of `decoded`, as the similar lookup asks for them: each slot's raw text. */
export function knownCriteria(decoded: DecodedSpecId): SimilarCriteria {
  const criteria: SimilarCriteria = {};
  for (const slot of decoded.slots) {
    if (slot.state === 'value' && !NOT_ASKED.has(slot.key)) criteria[slot.key] = slot.raw;
  }
  return criteria;
}
