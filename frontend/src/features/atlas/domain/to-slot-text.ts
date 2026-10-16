import type { SlotKey } from './atlas';
import { MEASURED_SLOTS } from './slot-controls';

const DIGITS = /^\d+$/;
const TENTHS = /^(\d+)(?:\.(\d))?$/;
const CAPACITY = /^([A-Za-z])(\d+)$/;

/**
 * What a person typed for a slot in a lookup, as the slot's raw text: `90`
 * is `0090`, `3.3` is `0033`, `Z6` is `Z0006`. Anything that does not fit is
 * returned as typed, so the server names the problem. Text only: nothing here
 * is arithmetic.
 */
export function toSlotText(key: SlotKey, text: string): string {
  if (key === 'capacity') {
    const capacity = CAPACITY.exec(text);
    return capacity ? `${capacity[1]}${(capacity[2] ?? '').padStart(4, '0')}` : text;
  }

  const width = MEASURED_SLOTS.find((slot) => slot.key === key)?.width;
  if (width === undefined) return text;

  if (key === 'unitWeight') {
    // The slot counts tenths of a gram: the whole digits, then one more.
    const weight = TENTHS.exec(text);
    return weight ? `${weight[1]}${weight[2] ?? '0'}`.padStart(width, '0') : text;
  }
  return DIGITS.test(text) && text.length <= width ? text.padStart(width, '0') : text;
}
