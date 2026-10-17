import { describe, expect, it } from 'vitest';
import { formatDay } from './format-day';

describe('formatDay', () => {
  it('writes the day, the month in words and the year', () => {
    expect(formatDay(new Date('2026-10-16T08:00:00Z'), 'UTC')).toBe('16 October 2026');
  });

  it("is the day in the viewer's own time zone", () => {
    expect(formatDay(new Date('2026-10-16T20:00:00Z'), 'Asia/Manila')).toBe('17 October 2026');
  });
});
