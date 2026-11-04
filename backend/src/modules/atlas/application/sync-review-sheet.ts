import type { UseCase } from '../../../shared/application/use-case.js';
import type { LibraryReviewReport } from './library-review-report.js';
import { identityOf, planRowsSync, sharedRowsTab, type CellChange, type RowsPlan } from './plan-rows-sync.js';
import { ReviewSheetSyncError, type ReviewSpreadsheet, type SheetTab } from './ports/review-spreadsheet.js';
import { reviewLayout } from './review-sheet-layout.js';

export interface SyncReviewSheetInput {
  /** Works out what would change and writes nothing. */
  readonly dryRun?: boolean;
}

/** What a sync changed, or, in a dry run, would change. */
export interface ReviewSheetSyncSummary {
  readonly dryRun: boolean;
  /** Whether the Rows tab was missing, and made whole. */
  readonly madeRows: boolean;
  readonly columnsAdded: readonly string[];
  readonly adopted: number;
  readonly updated: number;
  readonly added: number;
  readonly removed: number;
  /** The tabs written whole: every tab but Rows. */
  readonly rewritten: readonly string[];
  /** Each cell changed on the Rows tab, for a dry run to show. */
  readonly changes: readonly CellChange[];
}

/** How many times the Rows tab is read again when it changed under the sync, before the sync gives up for now. */
const ATTEMPTS = 3;

/**
 * Brings the shared review sheet in step with the library (plan 0016). The
 * Rows tab is changed only as `planRowsSync` says: Atlas's own cells, never a
 * review. Just before writing, the tab is read again; if a line moved since it
 * was read, someone sorted it, and the plan is made again from where the lines
 * are now. Then every other tab is written whole.
 */
export class SyncReviewSheet implements UseCase<SyncReviewSheetInput, ReviewSheetSyncSummary> {
  constructor(
    private readonly review: Pick<LibraryReviewReport, 'read'>,
    private readonly sheet: ReviewSpreadsheet,
  ) {}

  async execute(input: SyncReviewSheetInput = {}): Promise<ReviewSheetSyncSummary> {
    const dryRun = input.dryRun ?? false;
    const { report, keys } = await this.review.read();
    const layout = reviewLayout(report, { keys, shared: true });
    const tabs = await this.sheet.tabs();
    const others = [layout.readMe, layout.specIds, layout.needsALook, layout.dictionary];
    const existing = (name: string): SheetTab | null => tabs.find((tab) => tab.name === name) ?? null;

    let rowsTab = existing(layout.rows.name);
    let plan: RowsPlan | null = null;
    if (rowsTab === null) {
      if (!dryRun) {
        await this.sheet.replace(sharedRowsTab(layout.rows), null, { tab: -1, rowOf: () => null });
        rowsTab = existing(layout.rows.name) ?? (await this.sheet.tabs()).find((tab) => tab.name === layout.rows.name) ?? null;
      }
    } else {
      plan = await this.syncRows(rowsTab, layout.rows, dryRun);
    }

    const rows = rowsTab;
    const lineRows = plan === null ? new Map(layout.rows.lines.map((line, index) => [line.key ?? '', index + 2])) : plan.rowOf;
    if (!dryRun) {
      for (const tab of others) {
        await this.sheet.replace(tab, existing(tab.name), { tab: rows?.id ?? -1, rowOf: (key) => lineRows.get(key) ?? null });
      }
    }
    return {
      dryRun,
      madeRows: plan === null,
      columnsAdded: plan?.columnsAdded ?? [],
      adopted: plan?.adopted ?? 0,
      updated: plan?.updated ?? 0,
      added: plan?.added ?? layout.rows.lines.length,
      removed: plan?.removed ?? 0,
      rewritten: others.map((tab) => tab.name),
      changes: plan?.changes ?? [],
    };
  }

  private async syncRows(tab: SheetTab, rows: Parameters<typeof planRowsSync>[1], dryRun: boolean): Promise<RowsPlan> {
    let grid = await this.sheet.read(tab);
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const planned = planRowsSync(grid, rows);
      if (!planned.ok) throw new ReviewSheetSyncError(planned.reason);
      const { plan } = planned;
      if (dryRun || plan.edit.writes.length === 0) return plan;
      const now = await this.sheet.read(tab);
      if (identityOf(now, plan.headerRow) === identityOf(grid, plan.headerRow)) {
        await this.sheet.editRows(tab, { ...plan.edit, rows: Math.max(plan.edit.rows, tab.rows) });
        return plan;
      }
      grid = now;
    }
    throw new ReviewSheetSyncError('The Rows tab kept changing while Atlas synced it, so Atlas wrote nothing to it. It will try again.');
  }
}
