import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { LibraryReviewReport } from './library-review-report.js';
import type { ReviewSheetWriter } from './ports/review-sheet-writer.js';

/** The review workbook as a file to download. */
export interface ReviewSheetFile {
  /** `atlas-spec-ids-2026-11-04.xlsx`. */
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/**
 * The Spec IDs sheet of the library as it stands, to download (plan 0014,
 * plan 0016): made from the library's review, which the shared sheet's sync
 * is made from too.
 */
export class ExportReviewSheet implements UseCase<void, ReviewSheetFile> {
  constructor(
    private readonly review: Pick<LibraryReviewReport, 'read'>,
    private readonly writer: ReviewSheetWriter,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ReviewSheetFile> {
    const { report } = await this.review.read();
    return { fileName: `atlas-spec-ids-${this.clock.now().toISOString().slice(0, 10)}.xlsx`, bytes: await this.writer.toBytes(report) };
  }
}
