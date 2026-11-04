import type { UseCase } from '../../../shared/application/use-case.js';
import type { ReviewSheetSyncScheduler, ReviewSheetSyncState, ReviewSheetSyncStatus } from './review-sheet-sync-scheduler.js';

/** Where the shared sheet's sync is, as an answer to send. */
export interface ReviewSheetSyncDto {
  state: ReviewSheetSyncState;
  /** ISO 8601; null before the first sync since the API started. */
  lastSyncedAt: string | null;
  failure: { at: string; message: string } | null;
}

/** Where the shared review sheet is: a Google Sheet's address, or null when none is set; and its sync, or null when Atlas does not keep it. */
export interface ReviewSheetLinkDto {
  url: string | null;
  sync: ReviewSheetSyncDto | null;
}

export function syncDtoOf(status: ReviewSheetSyncStatus): ReviewSheetSyncDto {
  return {
    state: status.state,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    failure: status.failure === null ? null : { at: status.failure.at.toISOString(), message: status.failure.message },
  };
}

/**
 * The shared Google Sheet the departments review the codes in (plan 0016),
 * set by the host in `ATLAS_REVIEW_SHEET_URL`, and how its sync stands. Its
 * address is handed only to signed-in staff: it leads to Source One text, and
 * the repository is public.
 */
export class GetReviewSheetLink implements UseCase<void, ReviewSheetLinkDto> {
  constructor(
    private readonly url: string | null,
    private readonly sync: Pick<ReviewSheetSyncScheduler, 'status'> | null = null,
  ) {}

  async execute(): Promise<ReviewSheetLinkDto> {
    return { url: this.url, sync: this.sync === null ? null : syncDtoOf(this.sync.status()) };
  }
}

/** An admin's Sync now: syncs at once and says how it went; null when Atlas does not keep the sheet (plan 0016). */
export class SyncReviewSheetNow implements UseCase<void, ReviewSheetSyncDto | null> {
  constructor(private readonly sync: Pick<ReviewSheetSyncScheduler, 'syncNow'> | null) {}

  async execute(): Promise<ReviewSheetSyncDto | null> {
    return this.sync === null ? null : syncDtoOf(await this.sync.syncNow());
  }
}
