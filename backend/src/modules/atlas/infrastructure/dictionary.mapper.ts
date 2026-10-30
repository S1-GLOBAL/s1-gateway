import { Dictionary } from '../domain/dictionary.js';
import type { DictionarySlotKey, RuledSlotKey, SlotRule } from '../domain/slots.js';
import type {
  atlasDictionaryReleases,
  atlasDictionaryRenames,
  atlasDictionaryRetiredNumbers,
  atlasDictionarySearchWords,
  atlasDictionaryValues,
  atlasSlotRules,
} from './atlas-dictionary.table.js';

type ReleaseRow = typeof atlasDictionaryReleases.$inferSelect;
type ValueRow = typeof atlasDictionaryValues.$inferSelect;
type RuleRow = typeof atlasSlotRules.$inferSelect;
type RenameRow = typeof atlasDictionaryRenames.$inferSelect;
type SearchWordRow = typeof atlasDictionarySearchWords.$inferSelect;
type RetiredRow = typeof atlasDictionaryRetiredNumbers.$inferSelect;
type NewValueRow = typeof atlasDictionaryValues.$inferInsert;
type NewRuleRow = typeof atlasSlotRules.$inferInsert;

/** What approved changes added: nothing for a release only migrations made. */
export interface HistoryRows {
  renames: readonly RenameRow[];
  searchWords: readonly SearchWordRow[];
  retired: readonly RetiredRow[];
  latest: { number: number; at: Date } | null;
}

/** Rows become a Dictionary here. Only slot keys and rules the domain knows are ever written. */
export function toDomain(
  release: ReleaseRow,
  values: readonly ValueRow[],
  rules: readonly RuleRow[],
  history: HistoryRows = { renames: [], searchWords: [], retired: [], latest: null },
): Dictionary {
  return new Dictionary(
    release.release,
    release.approvedOn,
    // A value without a number, only in S1 0.1.0, is numbered in the order read.
    values.map((row) => ({
      slot: row.slot as DictionarySlotKey,
      code: row.code,
      meaning: row.meaning,
      ...(row.number === null ? {} : { number: row.number }),
      ...(row.legacyCode === null ? {} : { legacyCode: row.legacyCode }),
      // An option's key is its number, as text (ADR 0033).
      ...(row.broaderNumber === null ? {} : { broader: String(row.broaderNumber) }),
    })),
    rules.map((row) => ({ productType: row.productType, slot: row.slot as RuledSlotKey, rule: row.rule as SlotRule })),
    {
      renames: history.renames.map((row) => ({
        slot: row.slot as DictionarySlotKey,
        oldCode: row.oldCode,
        newCode: row.newCode,
        changeNumber: row.changeNumber,
      })),
      searchWords: history.searchWords.map((row) => ({
        slot: row.slot as DictionarySlotKey,
        word: row.word,
        code: row.code,
        changeNumber: row.changeNumber,
      })),
      retired: history.retired.map((row) => ({
        slot: row.slot as DictionarySlotKey,
        number: row.number,
        code: row.code,
        meaning: row.meaning,
        changeNumber: row.changeNumber,
        ...(row.legacyCode === null ? {} : { legacyCode: row.legacyCode }),
      })),
      change: history.latest,
    },
  );
}

/** A dictionary's values and rules as rows of its release, for the change store to write. */
export function toValueRows(dictionary: Dictionary): NewValueRow[] {
  return dictionary.values().map(({ slot, code, meaning, number, legacyCode, broader }) => ({
    release: dictionary.release,
    slot,
    code,
    meaning,
    number,
    legacyCode: legacyCode ?? null,
    broaderNumber: broader === undefined ? null : Number(broader),
  }));
}

export function toRuleRows(dictionary: Dictionary): NewRuleRow[] {
  return dictionary.slotRules().map(({ productType, slot, rule }) => ({ release: dictionary.release, productType, slot, rule }));
}
