import type { DecodedSpecId, SimilarCriteria } from './atlas';

/** The slots the similar lookup never asks about: S2 and XX are the same on every code. */
const NOT_ASKED = new Set(['formatVersion', 'variant']);

/** The known slots of `decoded`, as the similar lookup asks for them: each slot's raw text. */
export function knownCriteria(decoded: DecodedSpecId): SimilarCriteria {
  const criteria: SimilarCriteria = {};
  for (const slot of decoded.slots) {
    if (slot.state === 'value' && !NOT_ASKED.has(slot.key)) criteria[slot.key] = slot.raw;
  }
  return criteria;
}
