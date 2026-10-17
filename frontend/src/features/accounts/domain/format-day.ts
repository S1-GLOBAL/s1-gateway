/**
 * A day, as `16 October 2026`: in the viewer's own time zone, or in
 * `timeZone` when one is given. Atlas writes its saved dates the same way.
 */
export function formatDay(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}
