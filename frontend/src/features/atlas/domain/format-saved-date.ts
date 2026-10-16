/**
 * The day a Spec ID was saved, as `16 October 2026`: in the viewer's own time
 * zone, or in `timeZone` when one is given.
 */
export function formatSavedDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}
