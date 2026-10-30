import { SLOTS } from '../slots.js';
import type { SpecId } from '../spec-id.js';

/** A Spec ID's 25 slot values joined by dots, as a test compares them: `5.17.Y.3.1.X.10012…`. For tests only. */
export function slotsOf(specId: SpecId): string {
  return SLOTS.map(({ key }) => specId.slot(key)).join('.');
}
