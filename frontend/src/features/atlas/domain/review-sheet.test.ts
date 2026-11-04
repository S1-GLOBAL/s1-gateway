import { describe, expect, it } from 'vitest';
import { describeSheetSync, type ReviewSheetSync } from './review-sheet';

const NOW = new Date('2026-11-04T06:30:00.000Z');
const ZONE = 'Asia/Manila';
const idle: ReviewSheetSync = { state: 'idle', lastSyncedAt: new Date('2026-11-04T06:05:00.000Z'), failure: null };

describe('describeSheetSync (plan 0016)', () => {
  it("says today's sync by its time, and an earlier day's with its day", () => {
    expect(describeSheetSync(idle, NOW, { timeZone: ZONE })).toEqual({ text: 'Sheet synced 14:05', failed: false });
    expect(describeSheetSync({ ...idle, lastSyncedAt: new Date('2026-11-03T06:05:00.000Z') }, NOW, { timeZone: ZONE }).text).toBe(
      'Sheet synced 3 November, 14:05',
    );
  });

  it('says a sync is waiting or running, or has not run since the API started', () => {
    expect(describeSheetSync({ ...idle, state: 'waiting' }, NOW).text).toBe('Sheet syncs within a minute');
    expect(describeSheetSync({ ...idle, state: 'syncing' }, NOW).text).toBe('Syncing the sheet…');
    expect(describeSheetSync({ ...idle, lastSyncedAt: null }, NOW).text).toBe('Sheet not synced yet');
  });

  it('says a sync failed: why, to an admin; that it will be tried again, to staff', () => {
    const failed = { ...idle, failure: { at: new Date('2026-11-04T06:10:00.000Z'), message: 'Google Sheets is busy.' } };
    expect(describeSheetSync(failed, NOW, { forAdmin: true, timeZone: ZONE })).toEqual({
      text: 'Sheet sync failed at 14:10. Google Sheets is busy.',
      failed: true,
    });
    expect(describeSheetSync(failed, NOW, { timeZone: ZONE }).text).toBe('Sheet sync failed at 14:10. Atlas will try again.');
    // Once a sync is running again, it says so.
    expect(describeSheetSync({ ...failed, state: 'syncing' }, NOW).failed).toBe(false);
  });
});
