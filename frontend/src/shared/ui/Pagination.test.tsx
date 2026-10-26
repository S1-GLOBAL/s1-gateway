import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });

  it('marks the current page and moves when a number is pressed', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={2} hasMore onPageChange={onPageChange} />);

    const current = screen.getByRole('button', { name: 'Page 1' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.querySelector('[aria-hidden="true"]')?.className).toContain('bg-surface');
    expect(current.className).not.toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
  });

  it('skips the middle of a long run', () => {
    render(<Pagination page={5} pageCount={10} onPageChange={() => {}} />);

    for (const page of [1, 4, 5, 6, 10]) {
      expect(screen.getByRole('button', { name: `Page ${page}` })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Page 2' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Page 7' })).toBeNull();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('shows the page it is waiting on as busy, and holds the others', () => {
    render(<Pagination page={1} pageCount={1} hasMore pendingPage={2} onPageChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'Page 2' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Page 1' }).hasAttribute('disabled')).toBe(false);
  });
});
