import type { DecodedSpecId, SlotKey } from './atlas';
import type { BuildForm } from './build-facts';
import { CODE_SLOTS, MEASURED_SLOTS } from './slot-controls';

const DIGITS = /^\d+$/;

/**
 * The form that builds `decoded` again: each known slot's value, in the unit
 * its code counts in (`0090` → 90 mm, `0033` → 3.3 g, `Z0016` → Z and 16).
 * Not known and doesn't apply leave a choice empty. Text only: `toFacts` of
 * the result encodes back to the same code.
 */
export function toBuildForm(decoded: DecodedSpecId): BuildForm {
  const known = (key: SlotKey): string | undefined => {
    const slot = decoded.slots.find((candidate) => candidate.key === key);
    return slot?.state === 'value' ? slot.raw : undefined;
  };

  const capacity = known('capacity');
  return {
    productType: known('productType') ?? '',
    codes: Object.fromEntries(CODE_SLOTS.map((key) => [key, known(key) ?? ''])) as BuildForm['codes'],
    capacityUnit: capacity?.slice(0, 1) ?? '',
    capacityValue: capacity ? withoutLeadingZeros(capacity.slice(1)) : '',
    measures: Object.fromEntries(
      MEASURED_SLOTS.map((slot) => {
        const raw = known(slot.key);
        const unit = slot.units[0]?.value ?? '';
        if (raw === undefined || !DIGITS.test(raw)) return [slot.key, { value: '', unit }];
        return [slot.key, { value: slot.key === 'unitWeight' ? tenths(raw) : withoutLeadingZeros(raw), unit }];
      }),
    ) as BuildForm['measures'],
  };
}

/** `0090` → `90`. */
function withoutLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}

/** Tenths of a gram as grams: `0033` → `3.3`, `0040` → `4`. */
function tenths(digits: string): string {
  const padded = digits.padStart(2, '0');
  const whole = withoutLeadingZeros(padded.slice(0, -1));
  const tenth = padded.slice(-1);
  return tenth === '0' ? whole : `${whole}.${tenth}`;
}
