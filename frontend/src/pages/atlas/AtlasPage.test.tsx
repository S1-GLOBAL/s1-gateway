import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AtlasGatewayProvider, type AtlasGateway } from '@/features/atlas';
import {
  gatewayWith,
  ILLUSTRATIVE,
  s1Dictionary,
  savedFor,
} from '@/features/atlas/application/testing/atlas-fixtures';
import { AppError } from '@/shared/application/app-error';
import { AtlasPage } from './AtlasPage';
import { AtlasPageSkeleton } from './AtlasPageSkeleton';

const EMPTY = { items: [], page: 1, pageSize: 20, total: 0 };

function renderPage(overrides: Partial<AtlasGateway> = {}) {
  const library = overrides.library ?? vi.fn<AtlasGateway['library']>(async () => EMPTY);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gatewayWith({ dictionary: async () => s1Dictionary, ...overrides, library })}>
        <MemoryRouter>
          <RouteBoundary skeleton={<AtlasPageSkeleton />}>
            <AtlasPage />
          </RouteBoundary>
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return library;
}

describe('AtlasPage', () => {
  it('draws the search stage before the page arrives', () => {
    render(<AtlasPageSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading Atlas' })).toBeTruthy();
  });

  it('shows that skeleton while the dictionary loads', () => {
    renderPage({ dictionary: () => new Promise(() => undefined) });
    expect(screen.getByRole('status', { name: 'Loading Atlas' })).toBeTruthy();
  });

  it('opens on Search, and lists nothing until a name is asked for', async () => {
    const library = vi.fn<AtlasGateway['library']>(async () => ({
      ...EMPTY,
      items: [savedFor(ILLUSTRATIVE, 'Bowl lid')],
      total: 1,
    }));
    renderPage({ library });
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Atlas' }).className).toContain('sr-only');
    expect(screen.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected')).toBe('true');

    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(search.getAttribute('placeholder')).toBe('Search by name, or paste a Spec ID');
    expect(screen.queryByRole('button', { name: 'Dictionary' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New Spec ID' })).toBeNull();
    expect(screen.queryByText('Product type')).toBeNull();
    expect(screen.queryByText('Bowl lid')).toBeNull();
    expect(library).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: 'lid' } });

    expect(await screen.findByRole('link', { name: /Bowl lid/ })).toBeTruthy();
    expect(library).toHaveBeenLastCalledWith({ q: 'lid', productType: '', page: 1 });
  });

  it('keeps what was typed when leaving Search and coming back', async () => {
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'bowl lid' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(screen.queryByRole('searchbox', { name: 'Search' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect((screen.getByRole('searchbox', { name: 'Search' }) as HTMLInputElement).value).toBe('bowl lid');
  });

  it('shows the reason the dictionary failed, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dictionary = vi
      .fn<AtlasGateway['dictionary']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(s1Dictionary);
    renderPage({ dictionary });

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('tab', { name: 'Search' })).toBeTruthy();
    expect(dictionary).toHaveBeenCalledTimes(2);
  });

  it('moves across the tabs with the arrow keys, and wraps', async () => {
    renderPage();
    const search = await screen.findByRole('tab', { name: 'Search' });
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowRight' });

    const browse = screen.getByRole('tab', { name: 'Browse' });
    expect(browse.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(browse);
    expect(screen.queryByRole('searchbox', { name: 'Search' })).toBeNull();

    fireEvent.keyDown(browse, { key: 'ArrowRight' });
    const analyze = screen.getByRole('tab', { name: 'Analyze' });
    expect(analyze.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(analyze, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy();
  });
});
