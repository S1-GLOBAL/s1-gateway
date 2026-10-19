import type { Dictionary } from './dictionary.js';
import { DOES_NOT_APPLY, NOT_KNOWN, PAPER_FAMILY, ROUND_SHAPE, type RuledSlotKey } from './slots.js';

/**
 * What a ruled slot must hold for a product (ADR 0019, "Which slots apply"):
 * `any` is a value or `Y`, `does-not-apply` is `X`, and `not-known` is `Y`
 * because the shape or material it depends on is not known.
 */
export type ExpectedFill =
  | { readonly fill: 'any' | 'does-not-apply'; readonly dependsOn?: undefined }
  | { readonly fill: 'not-known'; readonly dependsOn: 'shape' | 'material' };

/** `Y`: the product has this property, but no source states it. */
export function isNotKnown(raw: string): boolean {
  return raw === NOT_KNOWN;
}

/** `X`: the product never has this property. */
export function isDoesNotApply(raw: string): boolean {
  return raw === DOES_NOT_APPLY;
}

/**
 * The fill a ruled slot of `productType` expects, given the raw shape and
 * material. Pass `undefined` for a shape or material that failed its own
 * check: the slots that depend on it are then skipped (null), because that
 * slot's own message is enough. A shape or material of `X` is skipped too.
 */
export function expectedFill(
  dictionary: Dictionary,
  productType: string,
  key: RuledSlotKey,
  shape: string | undefined,
  material: string | undefined,
): ExpectedFill | null {
  const rule = dictionary.ruleFor(productType, key);
  switch (rule) {
    case 'applies':
      return { fill: 'any' };
    case 'never':
      return { fill: 'does-not-apply' };
    case 'round_only':
    case 'non_round_only': {
      if (shape === undefined || isDoesNotApply(shape)) return null;
      if (isNotKnown(shape)) return { fill: 'not-known', dependsOn: 'shape' };
      const round = shape === ROUND_SHAPE;
      return { fill: round === (rule === 'round_only') ? 'any' : 'does-not-apply' };
    }
    case 'paper_only': {
      if (material === undefined || isDoesNotApply(material)) return null;
      if (isNotKnown(material)) return { fill: 'not-known', dependsOn: 'material' };
      return { fill: material.startsWith(PAPER_FAMILY) ? 'any' : 'does-not-apply' };
    }
  }
}
