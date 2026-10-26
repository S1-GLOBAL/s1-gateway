export type PaginationItem = number | 'gap';

function range(from: number, to: number): number[] {
  const pages: number[] = [];
  for (let page = from; page <= to; page += 1) pages.push(page);
  return pages;
}

/**
 * The page numbers to offer. Seven or fewer are all shown. Beyond that, the
 * first, the last, and the current page with its neighbours — a gap stands
 * where a run is skipped.
 */
export function paginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 7) return range(1, Math.max(total, 0));

  const left = Math.max(current - 1, 1);
  const right = Math.min(current + 1, total);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;

  if (!showLeftGap && showRightGap) return [...range(1, 5), 'gap', total];
  if (showLeftGap && !showRightGap) return [1, 'gap', ...range(total - 4, total)];
  if (showLeftGap && showRightGap) return [1, 'gap', ...range(left, right), 'gap', total];
  return range(1, total);
}
