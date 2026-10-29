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
}

export interface SlotRuleEntry {
  readonly productType: string;
  readonly slot: RuledSlotKey;
  readonly rule: SlotRule;
}

/**
 * A code an approved change renamed or deleted, and its live letters now:
 * null once deleted. Flattened, so one step reaches the live letters (ADR 0031).
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
  /** The option's letters when it was deleted. */
  readonly code: string;
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
 * One release of the Atlas dictionary: every code's meaning, and which slots
 * apply to each product type; for the live release, also what approved
 * changes renamed, the search words they gave, and the latest change.
 */
export class Dictionary {
  private readonly meanings = new Map<string, string>();
  private readonly rules = new Map<string, SlotRule>();
  private readonly liveLetters = new Map<string, string | null>();
  private readonly allValues: readonly NumberedValue[];
  private readonly numbers = new Map<string, number>();
  private readonly numbered = new Map<string, NumberedValue>();
  private readonly highest = new Map<DictionarySlotKey, number>();

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
   * The letters `code` reads as now: the code itself while it exists, else a
   * renamed code's new letters, undefined once deleted. A code the dictionary
   * never had is itself too, for whatever reads it to refuse. A code written
   * before a change reads through this (ADR 0031); code that names an S2
   * 0.1.0 code uses `liveOriginal`.
   */
  live(slot: DictionarySlotKey, code: string): string | undefined {
    const key = `${slot}:${code}`;
    if (this.meanings.has(key) || !this.liveLetters.has(key)) return code;
    return this.liveLetters.get(key) ?? undefined;
  }

  /** The letters a capacity value reads as now, its unit followed: `Z14` is `O14` once `Z` is renamed `O`. */
  liveCapacity(value: string): string | undefined {
    const unit = this.live('capacity', value.slice(0, 1));
    return unit === undefined ? undefined : `${unit}${value.slice(1)}`;
  }

  /**
   * The letters an S2 0.1.0 code has now, for code that names one (the word
   * list, the keywords, the size rulings): its rename's letters, undefined
   * once deleted, else itself. Unlike `live`, letters another option took
   * after the code moved never read as that option (ADR 0031).
   */
  liveOriginal(slot: DictionarySlotKey, code: string): string | undefined {
    const key = `${slot}:${code}`;
    return this.liveLetters.has(key) ? (this.liveLetters.get(key) ?? undefined) : code;
  }

  /** `liveOriginal` for a capacity value: its unit followed, its number kept. */
  liveOriginalCapacity(value: string): string | undefined {
    const unit = this.liveOriginal('capacity', value.slice(0, 1));
    return unit === undefined ? undefined : `${unit}${value.slice(1)}`;
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

  /** A slot's values, ordered by code. */
  valuesOf(slot: DictionarySlotKey): NumberedValue[] {
    return this.allValues.filter((value) => value.slot === slot).sort((a, b) => compare(a.code, b.code));
  }

  /** Every value, slot by slot in code order, each slot's values ordered by code. */
  values(): NumberedValue[] {
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
