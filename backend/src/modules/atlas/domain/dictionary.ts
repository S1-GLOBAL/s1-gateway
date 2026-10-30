import { DICTIONARY_SLOTS, RULED_SLOTS, type DictionarySlotKey, type RuledSlotKey, type SlotRule } from './slots.js';

export interface DictionaryValue {
  readonly slot: DictionarySlotKey;
  readonly code: string;
  readonly meaning: string;
  /**
   * The option's number in its list, written after the list's letter in a
   * code: `B17` (ADR 0032). Given once, in the order options were issued, and
   * never moved. A capacity unit's number is the digit after `G`: `G112` is
   * 12 of unit 1, oz. Left out, the dictionary numbers it after every number
   * it already holds.
   */
  readonly number?: number;
  /**
   * The letters the option had before options were known by number (ADR
   * 0033), kept only to read a dotted code given out before. An option added
   * since has none.
   */
  readonly legacyCode?: string;
  /** For a material, the broader material it is a grade of: kraft for recycled kraft (ADR 0033). */
  readonly broader?: string;
}

export interface SlotRuleEntry {
  readonly productType: string;
  readonly slot: RuledSlotKey;
  readonly rule: SlotRule;
}

/**
 * Letters an approved change renamed or deleted before options were known by
 * number, and the letters they had then: null once deleted. Flattened, so one
 * step reaches the last letters (ADR 0031). Read only for a dotted code.
 */
export interface DictionaryRename {
  readonly slot: DictionarySlotKey;
  readonly oldCode: string;
  readonly newCode: string | null;
  /** The change that last moved it. */
  readonly changeNumber: number;
}

/** A word an approved change gave an option, read in pasted text as that option (ADR 0031). */
export interface DictionarySearchWord {
  readonly slot: DictionarySlotKey;
  /** Lower case, one space between words. */
  readonly word: string;
  readonly code: string;
  /** The change that gave it. */
  readonly changeNumber: number;
}

/** A value as the dictionary holds it: always numbered. */
export type NumberedValue = DictionaryValue & { readonly number: number };

/**
 * A number whose option an approved change deleted, kept so a code written
 * before still reads, and so the number is never given to another option
 * (ADR 0032).
 */
export interface DictionaryRetiredNumber {
  readonly slot: DictionarySlotKey;
  readonly number: number;
  /** The option's key when it was deleted: its number, as text. */
  readonly code: string;
  /** Its letters, for one deleted before options were known by number (ADR 0033). */
  readonly legacyCode?: string;
  readonly meaning: string;
  /** The change that deleted it; null for one deleted before numbers were stored. */
  readonly changeNumber: number | null;
}

/** The latest approved change: dictionary change #N, and when it was approved. */
export interface DictionaryChangeStamp {
  readonly number: number;
  readonly at: Date;
}

/** What approved changes added to a release: none for a release only migrations made. */
export interface DictionaryHistory {
  readonly renames?: readonly DictionaryRename[];
  readonly searchWords?: readonly DictionarySearchWord[];
  readonly retired?: readonly DictionaryRetiredNumber[];
  readonly change?: DictionaryChangeStamp | null;
}

/**
 * One release of the Atlas dictionary: every option's meaning, under its key,
 * and which slots apply to each product type; for the live release, also the
 * search words approved changes gave, what they renamed or deleted, and the
 * latest change. In S2 an option's key is its number, as text (ADR 0033).
 */
export class Dictionary {
  private readonly meanings = new Map<string, string>();
  private readonly rules = new Map<string, SlotRule>();
  private readonly liveLetters = new Map<string, string | null>();
  private readonly allValues: readonly NumberedValue[];
  private readonly numbers = new Map<string, number>();
  private readonly numbered = new Map<string, NumberedValue>();
  private readonly highest = new Map<DictionarySlotKey, number>();
  private readonly broader = new Map<string, string>();

  constructor(
    readonly release: string,
    /** `YYYY-MM-DD`. */
    readonly approvedOn: string,
    values: readonly DictionaryValue[],
    private readonly allRules: readonly SlotRuleEntry[],
    private readonly history: DictionaryHistory = {},
  ) {
    for (const value of values) if (value.number !== undefined) this.raise(value.slot, value.number);
    for (const retired of history.retired ?? []) this.raise(retired.slot, retired.number);
    // A value without a number takes the next one, in the order given: the order it was issued.
    this.allValues = values.map((value): NumberedValue => {
      if (value.number !== undefined) return { ...value, number: value.number };
      const number = (this.highest.get(value.slot) ?? 0) + 1;
      this.raise(value.slot, number);
      return { ...value, number };
    });
    for (const value of this.allValues) {
      this.meanings.set(`${value.slot}:${value.code}`, value.meaning);
      this.numbers.set(`${value.slot}:${value.code}`, value.number);
      this.numbered.set(`${value.slot}:${value.number}`, value);
      if (value.slot === 'material' && value.broader !== undefined) this.broader.set(value.code, value.broader);
    }
    for (const entry of allRules) this.rules.set(`${entry.productType}:${entry.slot}`, entry.rule);
    for (const rename of history.renames ?? []) this.liveLetters.set(`${rename.slot}:${rename.oldCode}`, rename.newCode);
  }

  private raise(slot: DictionarySlotKey, number: number): void {
    this.highest.set(slot, Math.max(this.highest.get(slot) ?? 0, number));
  }

  /** The number of option `code` in `slot`, or undefined when the dictionary does not have it. */
  numberOf(slot: DictionarySlotKey, code: string): number | undefined {
    return this.numbers.get(`${slot}:${code}`);
  }

  /** The live option numbered `number` in `slot`, or undefined when none is, or it was deleted. */
  valueNumbered(slot: DictionarySlotKey, number: number): NumberedValue | undefined {
    return this.numbered.get(`${slot}:${number}`);
  }

  /** The deleted option that had `number` in `slot`, or undefined. */
  retiredNumbered(slot: DictionarySlotKey, number: number): DictionaryRetiredNumber | undefined {
    return this.history.retired?.find((retired) => retired.slot === slot && retired.number === number);
  }

  /** The number a new option in `slot` takes: one more than any it has had, deleted ones included. */
  nextNumber(slot: DictionarySlotKey): number {
    return (this.highest.get(slot) ?? 0) + 1;
  }

  /** Every deleted option's number, by list, then number. */
  retired(): DictionaryRetiredNumber[] {
    return [...(this.history.retired ?? [])].sort((a, b) => compare(a.slot, b.slot) || a.number - b.number);
  }

  /** The latest approved change, or null before the first. */
  get change(): DictionaryChangeStamp | null {
    return this.history.change ?? null;
  }

  /**
   * `code` while the dictionary has the option, undefined once it was deleted.
   * Code that names an option (`options.ts`) reads it through this, so a
   * deleted option is never read (ADR 0031).
   */
  live(slot: DictionarySlotKey, code: string): string | undefined {
    return this.meanings.has(`${slot}:${code}`) ? code : undefined;
  }

  /** `live` for a capacity: the value while its unit is in the dictionary, `10012`; undefined once deleted. */
  liveCapacity(value: string): string | undefined {
    return this.live('capacity', value.slice(0, 1)) === undefined ? undefined : value;
  }

  /**
   * The key of the option that had `letters` in a dotted code given out
   * before options were known by number, through any rename then (ADR 0031,
   * ADR 0033): the live option's, or a deleted one's. Undefined for letters no
   * option ever had.
   */
  fromLetters(slot: DictionarySlotKey, letters: string): string | undefined {
    const renamed = this.liveLetters.get(`${slot}:${letters}`);
    const last = renamed === undefined ? letters : renamed;
    const named = (candidate: { readonly slot: DictionarySlotKey; readonly legacyCode?: string | undefined }) =>
      candidate.slot === slot && (candidate.legacyCode === last || candidate.legacyCode === letters);
    if (last !== null) {
      const value = this.allValues.find(named);
      if (value !== undefined) return value.code;
    }
    return this.history.retired?.find(named)?.code;
  }

  /** `fromLetters` for a capacity written in a dotted code: `Z0012` is `10012`, unit 1 then the amount. */
  capacityFromLetters(value: string): string | undefined {
    const unit = this.fromLetters('capacity', value.slice(0, 1));
    return unit === undefined ? undefined : `${unit}${value.slice(1)}`;
  }

  /** The material `material` is a grade of, or undefined: kraft for recycled kraft. */
  broaderOf(material: string): string | undefined {
    return this.broader.get(material);
  }

  /** Whether `material` is `family` or a grade of it, at any depth: recycled kraft is paper. */
  isGradeOf(material: string, family: string): boolean {
    const seen = new Set<string>();
    for (let current: string | undefined = material; current !== undefined && !seen.has(current); current = this.broaderOf(current)) {
      if (current === family) return true;
      seen.add(current);
    }
    return false;
  }

  /** Every rename, by list then old code. */
  renames(): DictionaryRename[] {
    return [...(this.history.renames ?? [])].sort((a, b) => compare(a.slot, b.slot) || compare(a.oldCode, b.oldCode));
  }

  /** Every approved search word, by list, then word. */
  searchWords(): DictionarySearchWord[] {
    return [...(this.history.searchWords ?? [])].sort((a, b) => compare(a.slot, b.slot) || compare(a.word, b.word));
  }

  /** One option's approved search words, in order. */
  searchWordsOf(slot: DictionarySlotKey, code: string): string[] {
    return this.searchWords()
      .filter((word) => word.slot === slot && word.code === code)
      .map((word) => word.word);
  }

  /** The meaning of `code` in `slot`, or undefined when the dictionary has no such value. */
  meaningOf(slot: DictionarySlotKey, code: string): string | undefined {
    return this.meanings.get(`${slot}:${code}`);
  }

  /** A slot's values, by number. */
  valuesOf(slot: DictionarySlotKey): NumberedValue[] {
    return this.allValues.filter((value) => value.slot === slot).sort((a, b) => a.number - b.number);
  }

  /** Every value, slot by slot in code order, each slot's values by number. */
  values(): NumberedValue[] {
    return DICTIONARY_SLOTS.flatMap((slot) => this.valuesOf(slot));
  }

  /** Every rule, by product type's number, then in slot order. */
  slotRules(): SlotRuleEntry[] {
    const order = (slot: RuledSlotKey) => RULED_SLOTS.indexOf(slot);
    const number = (productType: string) => this.numberOf('productType', productType) ?? 0;
    return [...this.allRules].sort(
      (a, b) => number(a.productType) - number(b.productType) || compare(a.productType, b.productType) || order(a.slot) - order(b.slot),
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
