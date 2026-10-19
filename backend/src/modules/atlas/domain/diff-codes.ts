import { isDoesNotApply, isNotKnown } from './applicability.js';
import { SLOTS, type SlotKey } from './slots.js';
import type { SpecId } from './spec-id.js';

/** One slot that differs between two codes, as raw slot text. */
export interface SlotDifference {
  readonly key: SlotKey;
  readonly before: string;
  readonly after: string;
  /** A known value was replaced: it was neither `Y` nor `X` before. */
  readonly corrected: boolean;
}

/** Every slot whose text differs between `before` and `after`, in code order. */
export function diffCodes(before: SpecId, after: SpecId): SlotDifference[] {
  return SLOTS.flatMap(({ key }) => {
    const was = before.slot(key);
    const now = after.slot(key);
    if (was === now) return [];
    return [{ key, before: was, after: now, corrected: !isNotKnown(was) && !isDoesNotApply(was) }];
  });
}
