/** How the shared review sheet's sync stands (plan 0016): nothing to do, a change waiting a minute, or syncing now. */
export type ReviewSheetSyncState = 'idle' | 'waiting' | 'syncing';

export interface ReviewSheetSync {
  readonly state: ReviewSheetSyncState;
  /** Null before the first sync since the API started. */
  readonly lastSyncedAt: Date | null;
  /** The last sync's failure, in words fit to show; null when it did not fail. */
  readonly failure: { readonly at: Date; readonly message: string } | null;
}

/** The shared review sheet: its address, or null when none is set; and its sync, or null when Atlas does not keep it in step. */
export interface ReviewSheetLink {
  readonly url: string | null;
  readonly sync: ReviewSheetSync | null;
}

function timeOf(date: Date, now: Date, timeZone?: string): string {
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date);
  const day = (when: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone }).format(when);
  return day(date) === day(now) ? time : `${day(date)}, ${time}`;
}

/**
 * The sync's status in a line: `Sheet synced 14:05`, today's time alone; a
 * failure says so, and, to an admin, why, as the API words it.
 */
export function describeSheetSync(sync: ReviewSheetSync, now: Date, { forAdmin = false, timeZone }: { forAdmin?: boolean; timeZone?: string } = {}): {
  readonly text: string;
  readonly failed: boolean;
} {
  if (sync.failure !== null && sync.state !== 'syncing') {
    const why = forAdmin ? ` ${sync.failure.message}` : ' Atlas will try again.';
    return { text: `Sheet sync failed at ${timeOf(sync.failure.at, now, timeZone)}.${why}`, failed: true };
  }
  if (sync.state === 'syncing') return { text: 'Syncing the sheet…', failed: false };
  if (sync.state === 'waiting') return { text: 'Sheet syncs within a minute', failed: false };
  if (sync.lastSyncedAt === null) return { text: 'Sheet not synced yet', failed: false };
  return { text: `Sheet synced ${timeOf(sync.lastSyncedAt, now, timeZone)}`, failed: false };
}
