import type { UseCase } from '../../../shared/application/use-case.js';

/** Where the shared review sheet is: a Google Sheet's address, or null when none is set. */
export interface ReviewSheetLinkDto {
  url: string | null;
}

/**
 * The shared Google Sheet the departments review the codes in (plan 0016),
 * set by the host in `ATLAS_REVIEW_SHEET_URL`. Its address is handed only to
 * signed-in staff: it leads to Source One text, and the repository is public.
 */
export class GetReviewSheetLink implements UseCase<void, ReviewSheetLinkDto> {
  constructor(private readonly url: string | null) {}

  async execute(): Promise<ReviewSheetLinkDto> {
    return { url: this.url };
  }
}
