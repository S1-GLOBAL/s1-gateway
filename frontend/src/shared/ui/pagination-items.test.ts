import { describe, expect, it } from 'vitest';
import { paginationItems } from './pagination-items';

describe('paginationItems', () => {
  it('lists every page when there are seven or fewer', () => {
    expect(paginationItems(1, 1)).toEqual([1]);
    expect(paginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the ends and the current page when there are more', () => {
    expect(paginationItems(1, 8)).toEqual([1, 2, 3, 4, 5, 'gap', 8]);
    expect(paginationItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(paginationItems(8, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
    expect(paginationItems(10, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
  });
});
