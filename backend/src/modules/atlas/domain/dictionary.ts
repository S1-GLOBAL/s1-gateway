import { DICTIONARY_SLOTS, RULED_SLOTS, type DictionarySlotKey, type RuledSlotKey, type SlotRule } from './slots.js';

export interface DictionaryValue {
  readonly slot: DictionarySlotKey;
  readonly code: string;
  readonly meaning: string;
}

export interface SlotRuleEntry {
  readonly productType: string;
  readonly slot: RuledSlotKey;
  readonly rule: SlotRule;
}

/** One release of the S1 dictionary: every code's meaning, and which slots apply to each product type. */
export class Dictionary {
  private readonly meanings = new Map<string, string>();
  private readonly rules = new Map<string, SlotRule>();

  constructor(
    readonly release: string,
    /** `YYYY-MM-DD`. */
    readonly approvedOn: string,
    private readonly allValues: readonly DictionaryValue[],
    private readonly allRules: readonly SlotRuleEntry[],
  ) {
    for (const value of allValues) this.meanings.set(`${value.slot}:${value.code}`, value.meaning);
    for (const entry of allRules) this.rules.set(`${entry.productType}:${entry.slot}`, entry.rule);
  }

  /** The meaning of `code` in `slot`, or undefined when the dictionary has no such value. */
  meaningOf(slot: DictionarySlotKey, code: string): string | undefined {
    return this.meanings.get(`${slot}:${code}`);
  }

  /** A slot's values, ordered by code. */
  valuesOf(slot: DictionarySlotKey): DictionaryValue[] {
    return this.allValues.filter((value) => value.slot === slot).sort((a, b) => compare(a.code, b.code));
  }

  /** Every value, slot by slot in code order, each slot's values ordered by code. */
  values(): DictionaryValue[] {
    return DICTIONARY_SLOTS.flatMap((slot) => this.valuesOf(slot));
  }

  /** Every rule, by product type code, then in slot order. */
  slotRules(): SlotRuleEntry[] {
    const order = (slot: RuledSlotKey) => RULED_SLOTS.indexOf(slot);
    return [...this.allRules].sort(
      (a, b) => compare(a.productType, b.productType) || order(a.slot) - order(b.slot),
    );
  }

  /** The rule for a slot of a product type that is in this dictionary. A missing rule is a broken release. */
  ruleFor(productType: string, slot: RuledSlotKey): SlotRule {
    const rule = this.rules.get(`${productType}:${slot}`);
    if (!rule) throw new Error(`Dictionary ${this.release} has no rule for ${productType} ${slot}`);
    return rule;
  }
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
