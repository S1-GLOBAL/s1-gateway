import type { SlotKey, SlotRuleEntry } from './atlas';

/**
 * What a slot must hold, given the product type and the shape and material
 * chosen so far (ADR 0019, "Which slots apply"): a value or not known, `X`
 * because it never applies, or `0` because the shape or material it depends
 * on is not known yet.
 */
export type SlotState = 'any' | 'does-not-apply' | 'not-known';

const ROUND_SHAPE = 'RD';
const PAPER_FAMILY = 'B';

/**
 * The state of `slot` for `productType`. `shape` and `material` are the codes
 * chosen, `''` while not known. A slot with no rule, such as material, is `any`.
 */
export function slotStateFor(
  rules: readonly SlotRuleEntry[],
  productType: string,
  slot: SlotKey,
  shape: string,
  material: string,
): SlotState {
  const rule = rules.find((entry) => entry.productType === productType && entry.slot === slot)?.rule;
  switch (rule) {
    case undefined:
    case 'applies':
      return 'any';
    case 'never':
      return 'does-not-apply';
    case 'round_only':
    case 'non_round_only': {
      if (shape === '') return 'not-known';
      const round = shape === ROUND_SHAPE;
      return round === (rule === 'round_only') ? 'any' : 'does-not-apply';
    }
    case 'paper_only': {
      if (material === '') return 'not-known';
      return material.startsWith(PAPER_FAMILY) ? 'any' : 'does-not-apply';
    }
  }
}
