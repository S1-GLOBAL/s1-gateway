import { SLOT_NAMES, type SlotKey, type SlotRuleEntry } from './atlas';
import { slotStateFor } from './slot-state';

/** Every slot a product type's rules can rule out, in code order. */
const RULED: readonly SlotKey[] = SLOT_NAMES.map((slot) => slot.key).filter(
  (key) => !['formatVersion', 'productType', 'material', 'variant'].includes(key),
);

/** The slots that do not apply to `productType` with this shape and material: the workspace does not ask for them. */
export function leftOutSlots(
  rules: readonly SlotRuleEntry[],
  productType: string,
  shape: string,
  material: string,
): SlotKey[] {
  return RULED.filter((key) => slotStateFor(rules, productType, key, shape, material) === 'does-not-apply');
}

/** `a, b and c`. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
