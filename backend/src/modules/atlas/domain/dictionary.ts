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

/** The latest approved change: dictionary change #N, and when it was approved. */
export interface DictionaryChangeStamp {
  readonly number: number;
  readonly at: Date;
}

/** What approved changes added to a release: none for a release only migrations made. */
export interface DictionaryHistory {
  readonly renames?: readonly DictionaryRename[];
  readonly searchWords?: readonly DictionarySearchWord[];
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

  constructor(
    readonly release: string,
    /** `YYYY-MM-DD`. */
    readonly approvedOn: string,
    private readonly allValues: readonly DictionaryValue[],
    private readonly allRules: readonly SlotRuleEntry[],
    private readonly history: DictionaryHistory = {},
  ) {
    for (const value of allValues) this.meanings.set(`${value.slot}:${value.code}`, value.meaning);
    for (const entry of allRules) this.rules.set(`${entry.productType}:${entry.slot}`, entry.rule);
    for (const rename of history.renames ?? []) this.liveLetters.set(`${rename.slot}:${rename.oldCode}`, rename.newCode);
  }

  /** The latest approved change, or null before the first. */
  get change(): DictionaryChangeStamp | null {
    return this.history.change ?? null;
  }

  /**
   * The live letters of a code that once meant something: the code itself
   * while it exists, else a renamed code's new letters, undefined once
   * deleted. Code that names an S2 0.1.0 code reads it through this (ADR 0031).
   */
  live(slot: DictionarySlotKey, code: string): string | undefined {
    const key = `${slot}:${code}`;
    if (this.meanings.has(key)) return code;
    return this.liveLetters.get(key) ?? undefined;
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
