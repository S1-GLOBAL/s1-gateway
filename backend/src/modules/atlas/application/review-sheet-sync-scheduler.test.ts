import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '../../../shared/application/ports/clock.js';
import { RecordingLogger } from '../../../shared/application/testing/fakes.js';
import { ok, err } from '../../../shared/domain/result.js';
import { ReviewSheetSyncError } from './ports/review-spreadsheet.js';
import { ReviewSheetSyncScheduler, thenSync, type SchedulerTimings } from './review-sheet-sync-scheduler.js';
import type { ReviewSheetSyncSummary } from './sync-review-sheet.js';

const SUMMARY: ReviewSheetSyncSummary = {
  dryRun: false,
  madeRows: false,
  columnsAdded: [],
  adopted: 0,
  updated: 0,
  added: 0,
  removed: 0,
  rewritten: [],
  changes: [],
};
const TIMINGS: SchedulerTimings = { delayMs: 60_000, maxWaitMs: 300_000, retryMs: 300_000, maxRetryMs: 3_600_000 };

/** The clock the fake timers move. */
const clock: Clock = { now: () => new Date() };

function setup(outcomes: (() => Promise<ReviewSheetSyncSummary>)[] = []) {
  const execute = vi.fn(async () => (outcomes.shift() ?? (async () => SUMMARY))());
  const logger = new RecordingLogger();
  const scheduler = new ReviewSheetSyncScheduler({ execute }, clock, logger, TIMINGS);
  return { scheduler, execute, logger };
}

describe('ReviewSheetSyncScheduler (plan 0016)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-04T08:00:00.000Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs a minute after a change, several changes making one sync', async () => {
    const { scheduler, execute } = setup();
    scheduler.changed();
    await vi.advanceTimersByTimeAsync(30_000);
    scheduler.changed();
    expect(scheduler.status().state).toBe('waiting');

    await vi.advanceTimersByTimeAsync(59_000);
    expect(execute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(scheduler.status()).toEqual({ state: 'idle', lastSyncedAt: new Date('2026-11-04T08:01:30.000Z'), failure: null });
  });

  it('syncs five minutes after the first change, however many follow it', async () => {
    const { scheduler, execute } = setup();
    const at: string[] = [];
    execute.mockImplementation(async () => (at.push(new Date().toISOString()), SUMMARY));
    // A change every 50 seconds, from 08:00:00 to 08:07:30.
    for (let change = 0; change < 10; change += 1) {
      scheduler.changed();
      await vi.advanceTimersByTimeAsync(50_000);
    }
    expect(at).toEqual(['2026-11-04T08:05:00.000Z']);
  });

  it('makes one more sync after one that a change came during', async () => {
    let finish: (summary: ReviewSheetSyncSummary) => void = () => undefined;
    const { scheduler, execute } = setup([() => new Promise((resolve) => (finish = resolve))]);
    scheduler.changed();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(scheduler.status().state).toBe('syncing');

    scheduler.changed();
    scheduler.changed();
    finish(SUMMARY);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('says why a sync failed, in its own words, and tries again later each time', async () => {
    const { scheduler, execute, logger } = setup([
      () => Promise.reject(new ReviewSheetSyncError('Share the sheet with Atlas as an Editor.')),
      () => Promise.reject(new Error('socket hang up, at 10.0.0.1')),
    ]);
    scheduler.changed();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(scheduler.status().failure).toEqual({ at: new Date('2026-11-04T08:01:00.000Z'), message: 'Share the sheet with Atlas as an Editor.' });

    await vi.advanceTimersByTimeAsync(300_000);
    expect(execute).toHaveBeenCalledTimes(2);
    // Not the sync's own failure: its words stay in the log.
    expect(scheduler.status().failure?.message).toBe('The sync failed. The API log says why.');

    await vi.advanceTimersByTimeAsync(599_000);
    expect(execute).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(scheduler.status()).toMatchObject({ state: 'idle', failure: null });
    expect(logger.errors.map((entry) => entry.message)).toEqual(['Could not sync the shared review sheet', 'Could not sync the shared review sheet']);
  });

  it('syncs at once when asked, and a waiting sync is then not needed', async () => {
    const { scheduler, execute } = setup();
    scheduler.changed();

    const status = await scheduler.syncNow();

    expect(status).toEqual({ state: 'idle', lastSyncedAt: new Date('2026-11-04T08:00:00.000Z'), failure: null });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe('thenSync (plan 0016)', () => {
  it('asks for a sync after a use case does what it does, not after it answers a failure', async () => {
    const changed = vi.fn();
    const save = thenSync({ execute: async (name: string) => (name === '' ? err('EMPTY') : ok(name)) }, { changed });

    await save.execute('');
    expect(changed).not.toHaveBeenCalled();
    expect(await save.execute('Invented cup')).toEqual(ok('Invented cup'));
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('is the use case itself when the sheet is not synced', () => {
    const useCase = { execute: async () => 1 };
    expect(thenSync(useCase, null)).toBe(useCase);
  });
});
