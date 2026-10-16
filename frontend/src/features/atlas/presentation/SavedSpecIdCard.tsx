import { formatSavedDate } from '../domain/format-saved-date';
import type { SavedSpecId } from '../domain/atlas';
import { DecodedSlotsTable } from './DecodedSlotsTable';

/** One saved Spec ID in full: its name, code, who saved it when, and its 18 slots. */
export function SavedSpecIdCard({ saved, timeZone }: { saved: SavedSpecId; timeZone?: string }) {
  return (
    <article aria-label={saved.name} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <p className="text-md font-medium break-words text-ink">{saved.name}</p>
        <p className="font-mono text-sm break-all text-ink">{saved.code}</p>
        <p className="text-xs text-ink-muted">{`${saved.savedBy.fullName} · ${formatSavedDate(saved.savedAt, timeZone)}`}</p>
      </div>
      <DecodedSlotsTable rows={saved.slots} />
    </article>
  );
}
