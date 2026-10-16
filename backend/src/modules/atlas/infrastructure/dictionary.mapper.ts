import { Dictionary } from '../domain/dictionary.js';
import type { DictionarySlotKey, RuledSlotKey, SlotRule } from '../domain/slots.js';
import type { atlasDictionaryReleases, atlasDictionaryValues, atlasSlotRules } from './atlas-dictionary.table.js';

type ReleaseRow = typeof atlasDictionaryReleases.$inferSelect;
type ValueRow = typeof atlasDictionaryValues.$inferSelect;
type RuleRow = typeof atlasSlotRules.$inferSelect;

/** Rows become a Dictionary here. The migration wrote only slot keys and rules the domain knows. */
export function toDomain(release: ReleaseRow, values: readonly ValueRow[], rules: readonly RuleRow[]): Dictionary {
  return new Dictionary(
    release.release,
    release.approvedOn,
    values.map((row) => ({ slot: row.slot as DictionarySlotKey, code: row.code, meaning: row.meaning })),
    rules.map((row) => ({ productType: row.productType, slot: row.slot as RuledSlotKey, rule: row.rule as SlotRule })),
  );
}
