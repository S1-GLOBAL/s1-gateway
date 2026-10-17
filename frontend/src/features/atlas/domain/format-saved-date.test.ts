import { describe, expect, it } from 'vitest';
import { formatChangedAt, formatSavedDate } from './format-saved-date';

describe('formatSavedDate', () => {
  it('writes the day, the month in words and the year', () => {
    expect(formatSavedDate(new Date('2026-10-16T08:00:00Z'), 'UTC')).toBe('16 October 2026');
  });

  it("is the day in the viewer's own time zone", () => {
    expect(formatSavedDate(new Date('2026-10-16T20:00:00Z'), 'Asia/Manila')).toBe('17 October 2026');
  });

  it('does not pad a single-digit day', () => {
    expect(formatSavedDate(new Date('2026-03-05T08:00:00Z'), 'UTC')).toBe('5 March 2026');
  });
});

describe('formatChangedAt', () => {
  it('writes the day, then the time on a 24-hour clock', () => {
    expect(formatChangedAt(new Date('2026-10-17T14:32:00Z'), 'UTC')).toBe('17 October 2026, 14:32');
  });

  it("is the time in the viewer's own time zone", () => {
    expect(formatChangedAt(new Date('2026-10-16T20:05:00Z'), 'Asia/Manila')).toBe('17 October 2026, 04:05');
  });
});
