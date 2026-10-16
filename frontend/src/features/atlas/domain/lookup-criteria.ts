import type { SimilarCriteria } from './atlas';
import { CODE_SLOTS, MEASURED_SLOTS, type CodeSlotKey, type MeasuredSlotKey } from './slot-controls';
import { toSlotText } from './to-slot-text';

/** What the similar lookup's form holds. `''` is "Any" for every choice and every typed value. */
export interface LookupForm {
  productType: string;
  codes: Record<CodeSlotKey, string>;
  capacityUnit: string;
  capacityValue: string;
  /** Typed in each slot's own unit: millimetres, grams, gsm, µm. */
  measures: Record<MeasuredSlotKey, string>;
}

export function initialLookupForm(): LookupForm {
  return {
    productType: '',
    codes: { material: '', coating: '', colourClarity: '', shape: '', profile: '' },
    capacityUnit: '',
    capacityValue: '',
    measures: Object.fromEntries(MEASURED_SLOTS.map((slot) => [slot.key, ''])) as LookupForm['measures'],
  };
}

/** The slots to ask about: only those not left at Any, each as the slot's raw text. */
export function toCriteria(form: LookupForm): SimilarCriteria {
  const criteria: SimilarCriteria = {};
  if (form.productType !== '') criteria.productType = form.productType;
  for (const key of CODE_SLOTS) {
    if (form.codes[key] !== '') criteria[key] = form.codes[key];
  }
  if (form.capacityUnit !== '') {
    criteria.capacity = toSlotText('capacity', `${form.capacityUnit}${form.capacityValue.trim()}`);
  }
  for (const { key } of MEASURED_SLOTS) {
    const text = form.measures[key].trim();
    if (text !== '') criteria[key] = toSlotText(key, text);
  }
  return criteria;
}
