import type { DecodedSpecId } from './atlas';

/** The slot a summary leaves out: the variant, always X for now. */
const NOT_SUMMARISED = new Set(['variant']);

/** The sizes a summary names: "60 mm" alone does not say it is the height. A capacity or a count says what it is. */
const NAMED = new Set(['topDiameter', 'bottomDiameter', 'height', 'length', 'width', 'gusset', 'unitWeight', 'basisWeight', 'thickness']);

/** The known facts in plain words, in code order: `Bowl lid · Polymer, PS (polystyrene) · Clear · Top diameter 90 mm`. */
export function summarise(decoded: DecodedSpecId): string {
  return decoded.slots
    .filter((slot) => slot.state === 'value' && !NOT_SUMMARISED.has(slot.key))
    .map((slot) => (NAMED.has(slot.key) ? `${slot.name} ${slot.meaning}` : slot.meaning))
    .join(' · ');
}

/** How many slots are not known yet: the "{n} not known" badge. */
export function notKnownCount(decoded: DecodedSpecId): number {
  return decoded.slots.filter((slot) => slot.state === 'not-known').length;
}
