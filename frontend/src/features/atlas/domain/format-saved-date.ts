/**
 * The day a Spec ID was saved, as `16 October 2026`: in the viewer's own time
 * zone, or in `timeZone` when one is given.
 */
export function formatSavedDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}

/** When a change was made, as `17 October 2026, 14:32`: the day, then the 24-hour time. */
export function formatChangedAt(date: Date, timeZone?: string): string {
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
  return `${formatSavedDate(date, timeZone)}, ${time.format(date)}`;
}
