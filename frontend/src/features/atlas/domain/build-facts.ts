import type { SlotKey, SlotRuleEntry, SpecIdFacts } from './atlas';
import { slotStateFor } from './slot-state';
import { CODE_SLOTS, MEASURED_SLOTS, type CodeSlotKey, type MeasuredSlotKey } from './slot-controls';

/** What the Build form holds. `''` is "not known" for every choice and every typed value. */
export interface BuildForm {
  /** Never "not known": it decides which slots apply. The first by code is `BLD`. */
  productType: string;
  codes: Record<CodeSlotKey, string>;
  capacityUnit: string;
  capacityValue: string;
  measures: Record<MeasuredSlotKey, { value: string; unit: string }>;
}

export function initialBuildForm(productType: string): BuildForm {
  return {
    productType,
    codes: { material: '', coating: '', colourClarity: '', shape: '', profile: '' },
    capacityUnit: '',
    capacityValue: '',
    measures: Object.fromEntries(
      MEASURED_SLOTS.map((slot) => [slot.key, { value: '', unit: slot.units[0]?.value ?? '' }]),
    ) as BuildForm['measures'],
  };
}

/**
 * The facts to send for the form. A slot that does not apply, or is not known
 * yet because the shape or material it depends on is not, sends nothing, even
 * if a value was typed before the product type changed: the server fills it.
 */
export function toFacts(form: BuildForm, rules: readonly SlotRuleEntry[]): SpecIdFacts {
  const { shape, material } = form.codes;
  const open = (slot: SlotKey) =>
    slotStateFor(rules, form.productType, slot, shape, material) === 'any';

  const facts: SpecIdFacts = { productType: form.productType };
  for (const key of CODE_SLOTS) {
    const code = form.codes[key];
    if (code !== '' && open(key)) facts[key] = code;
  }
  if (form.capacityUnit !== '' && open('capacity')) {
    facts.capacity = { unit: form.capacityUnit, value: form.capacityValue.trim() };
  }
  for (const { key } of MEASURED_SLOTS) {
    const { value, unit } = form.measures[key];
    if (value.trim() !== '' && open(key)) facts[key] = { value: value.trim(), unit };
  }
  return facts;
}

/**
 * Whether `next` would save anything different from `saved`: compared as the
 * facts each sends, so a value changed and changed back is no change, and a
 * value typed into a slot that does not apply is none either.
 */
export function isFormChanged(saved: BuildForm, next: BuildForm, rules: readonly SlotRuleEntry[]): boolean {
  return JSON.stringify(toFacts(saved, rules)) !== JSON.stringify(toFacts(next, rules));
}
