import type { SpecIdChange } from './atlas';

/** Which filter of the History panel an entry belongs to, besides All. */
export type HistoryFilter = 'all' | 'facts' | 'name';

export function isRename(entry: SpecIdChange): boolean {
  return entry.kind === 'updated' && entry.nameBefore !== entry.nameAfter;
}

export function changesFacts(entry: SpecIdChange): boolean {
  return entry.kind === 'updated' && entry.slots.length > 0;
}

export function inFilter(entry: SpecIdChange, filter: HistoryFilter): boolean {
  if (filter === 'facts') return changesFacts(entry);
  if (filter === 'name') return isRename(entry);
  return true;
}

/**
 * What happened, as #16 words it: "Ada created it", "Ben updated 2 facts",
 * "Ben renamed it", "Ben updated 1 fact and renamed it".
 */
export function historySentence(entry: SpecIdChange): string {
  const who = entry.changedBy.fullName;
  if (entry.kind === 'created') return `${who} created it`;
  const count = entry.slots.length;
  const facts = `updated ${count} ${count === 1 ? 'fact' : 'facts'}`;
  if (count > 0 && isRename(entry)) return `${who} ${facts} and renamed it`;
  if (count > 0) return `${who} ${facts}`;
  return `${who} renamed it`;
}
