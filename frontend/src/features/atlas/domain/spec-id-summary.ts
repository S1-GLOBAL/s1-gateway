import type { DecodedSpecId } from './atlas';

/** The slots a summary leaves out: always S1, and always XX for now. */
const NOT_SUMMARISED = new Set(['formatVersion', 'variant']);

/** The known facts in plain words, in code order: `Bowl lid · Polymer, PS (polystyrene) · Clear · 90 mm`. */
export function summarise(decoded: DecodedSpecId): string {
  return decoded.slots
    .filter((slot) => slot.state === 'value' && !NOT_SUMMARISED.has(slot.key))
    .map((slot) => slot.meaning)
    .join(' · ');
}

/** How many slots are not known yet: the "{n} not known" badge. */
export function notKnownCount(decoded: DecodedSpecId): number {
  return decoded.slots.filter((slot) => slot.state === 'not-known').length;
}
