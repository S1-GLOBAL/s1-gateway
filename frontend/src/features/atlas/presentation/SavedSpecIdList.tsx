import { formatSavedDate } from '../domain/format-saved-date';
import type { SavedSpecId } from '../domain/atlas';

/** Saved Spec IDs, one line each: the name, the code, and who saved it when. */
export function SavedSpecIdList({ items, timeZone }: { items: readonly SavedSpecId[]; timeZone?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-surface border border-border bg-surface">
      {items.map((saved) => (
        <li key={saved.code} className="flex flex-col gap-0.5 px-4 py-3">
          <p className="text-sm font-medium break-words text-ink">{saved.name}</p>
          <p className="font-mono text-xs break-all text-ink-muted">{saved.code}</p>
          <p className="text-xs text-ink-muted">{`${saved.savedBy.fullName} · ${formatSavedDate(saved.savedAt, timeZone)}`}</p>
        </li>
      ))}
    </ul>
  );
}
