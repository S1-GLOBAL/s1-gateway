import type { Clock } from '../../../shared/application/ports/clock.js';
import type { Logger } from '../../../shared/application/ports/logger.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ReviewSheetSyncError } from './ports/review-spreadsheet.js';
import type { ReviewSheetSyncSummary, SyncReviewSheetInput } from './sync-review-sheet.js';

/** Where the shared sheet's sync is: nothing to do, a change waiting, or syncing now. */
export type ReviewSheetSyncState = 'idle' | 'waiting' | 'syncing';

export interface ReviewSheetSyncStatus {
  readonly state: ReviewSheetSyncState;
  /** When the sheet was last in step with Atlas; null before the first sync since the API started. */
  readonly lastSyncedAt: Date | null;
  /** The last sync's failure, when it failed: cleared by the next that does not. */
  readonly failure: { readonly at: Date; readonly message: string } | null;
}

export interface SchedulerTimings {
  /** How long after a change the sync runs, so several changes make one sync. */
  readonly delayMs: number;
  /** The longest a change waits, however many follow it. */
  readonly maxWaitMs: number;
  /** How long after a failed sync it is tried again, doubling each time up to `maxRetryMs`. */
  readonly retryMs: number;
  readonly maxRetryMs: number;
}

export const SYNC_TIMINGS: SchedulerTimings = { delayMs: 60_000, maxWaitMs: 5 * 60_000, retryMs: 5 * 60_000, maxRetryMs: 60 * 60_000 };

/** Said for a failure that is not the sync's own: the API's log has the rest. */
const UNKNOWN_FAILURE = 'The sync failed. The API log says why.';

/**
 * When the shared review sheet syncs (plan 0016): a minute after a change,
 * several changes making one sync; at once when an admin asks; one sync at a
 * time, a change during one making another after it. A failed sync is tried
 * again, later each time. Its status is kept in memory: after the API
 * restarts, the first sync, a minute after it starts, says when it last
 * synced.
 */
export class ReviewSheetSyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private firstChangeAt: number | null = null;
  private changedWhileRunning = false;
  private failures = 0;
  private lastSyncedAt: Date | null = null;
  private failure: { at: Date; message: string } | null = null;

  constructor(
    private readonly sync: UseCase<SyncReviewSheetInput, ReviewSheetSyncSummary>,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly timings: SchedulerTimings = SYNC_TIMINGS,
  ) {}

  /** Something the sheet shows changed: sync a minute from now, or, after several changes, at most a few minutes from the first. */
  changed(): void {
    if (this.running !== null) {
      this.changedWhileRunning = true;
      return;
    }
    const now = this.clock.now().getTime();
    this.firstChangeAt ??= now;
    const latest = this.firstChangeAt + this.timings.maxWaitMs - now;
    this.schedule(Math.max(0, Math.min(this.timings.delayMs, latest)));
  }

  /** Syncs now, after any sync already running, and says how it went. */
  async syncNow(): Promise<ReviewSheetSyncStatus> {
    this.clear();
    if (this.running !== null) await this.running;
    await this.run();
    return this.status();
  }

  status(): ReviewSheetSyncStatus {
    const state: ReviewSheetSyncState = this.running !== null ? 'syncing' : this.timer !== null ? 'waiting' : 'idle';
    return { state, lastSyncedAt: this.lastSyncedAt, failure: this.failure };
  }

  /** Stops any waiting sync: the API is shutting down. */
  stop(): void {
    this.clear();
  }

  private schedule(delay: number): void {
    this.clear();
    const timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, delay);
    // A waiting sync never keeps the process alive.
    timer.unref?.();
    this.timer = timer;
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private run(): Promise<void> {
    if (this.running !== null) {
      this.changedWhileRunning = true;
      return this.running;
    }
    // This sync covers every change so far: a sync still waiting is not needed.
    this.clear();
    this.firstChangeAt = null;
    this.changedWhileRunning = false;
    this.running = this.attempt().finally(() => {
      this.running = null;
      if (this.changedWhileRunning) this.changed();
    });
    return this.running;
  }

  private async attempt(): Promise<void> {
    try {
      const summary = await this.sync.execute({});
      this.lastSyncedAt = this.clock.now();
      this.failure = null;
      this.failures = 0;
      this.logger.info('Synced the shared review sheet', {
        adopted: summary.adopted,
        updated: summary.updated,
        added: summary.added,
        removed: summary.removed,
        columnsAdded: summary.columnsAdded,
        madeRows: summary.madeRows,
      });
    } catch (error) {
      const message = error instanceof ReviewSheetSyncError ? error.message : UNKNOWN_FAILURE;
      this.failure = { at: this.clock.now(), message };
      this.failures += 1;
      const retry = Math.min(this.timings.retryMs * 2 ** (this.failures - 1), this.timings.maxRetryMs);
      this.logger.error('Could not sync the shared review sheet', { err: error, retryInMs: retry });
      this.schedule(retry);
    }
  }
}

/**
 * A use case that, once it has done what it does, tells the scheduler the
 * shared sheet may need a sync; not when it answers a failure, which changed
 * nothing. The use case itself knows nothing of the sheet.
 */
export function thenSync<I, O>(useCase: UseCase<I, O>, scheduler: Pick<ReviewSheetSyncScheduler, 'changed'> | null): UseCase<I, O> {
  if (scheduler === null) return useCase;
  return {
    async execute(input: I): Promise<O> {
      const output = await useCase.execute(input);
      const failed = typeof output === 'object' && output !== null && 'ok' in output && output.ok === false;
      if (!failed) scheduler.changed();
      return output;
    },
  };
}
