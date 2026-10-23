import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AtlasGatewayProvider, type AtlasDictionary, type AtlasGateway } from '@/features/atlas';
import { AppError } from '@/shared/application/app-error';
import { AtlasPage } from './AtlasPage';
import { AtlasPageSkeleton } from './AtlasPageSkeleton';

/** An animated icon is drawn in the shared frame, which leaves overflow visible so a stroke can travel. */
function animatedIcon(control: HTMLElement): boolean {
  const svg = control.querySelector('svg');
  return svg?.style.overflow === 'visible' && svg.querySelectorAll('path').length === 2;
}

const dictionary: AtlasDictionary = {
  release: 'S1 0.1.0',
  approvedOn: '2026-10-16',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid' }] },
    { key: 'shape', name: 'Shape', values: [{ code: 'RD', meaning: 'Round' }] },
  ],
  rules: [{ productType: 'BLD', slot: 'topDiameter', rule: 'round_only' }],
};

function renderPage(load: AtlasGateway['dictionary']) {
  const pending = () => new Promise<never>(() => undefined);
  const gateway: AtlasGateway = {
    dictionary: load,
    decode: pending,
    encode: pending,
    save: pending,
    findByCode: pending,
    findSimilar: pending,
    readText: pending,
    getSaved: pending,
    update: pending,
    history: pending,
    manufacturers: pending,
    setManufacturerStage: pending,
    library: async () => ({ items: [], nextCursor: null }),
  };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <RouteBoundary skeleton={<AtlasPageSkeleton />}>
            <AtlasPage />
          </RouteBoundary>
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('AtlasPage', () => {
  it('shows its skeleton while the dictionary loads', () => {
    renderPage(() => new Promise(() => undefined));
    expect(screen.getByRole('status', { name: 'Loading Atlas' })).toBeTruthy();
  });

  it('opens on the library, with Dictionary and New Spec ID', async () => {
    renderPage(async () => dictionary);
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' })).toBeTruthy();
    expect(screen.getByText('One code for what a product physically is. Find a product, or describe a new one.')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dictionary' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'New Spec ID' })[0]?.getAttribute('href')).toBe('/atlas/new');
    expect(animatedIcon(screen.getByRole('button', { name: 'Dictionary' }))).toBe(true);
    for (const link of screen.getAllByRole('link', { name: 'New Spec ID' })) {
      expect(animatedIcon(link)).toBe(true);
    }
    expect(screen.queryByRole('heading', { name: 'Decode' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Build' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Look up' })).toBeNull();
  });

  it('opens the Dictionary sheet, and closes it with its button', async () => {
    renderPage(async () => dictionary);
    fireEvent.click(await screen.findByRole('button', { name: 'Dictionary' }));

    const sheet = screen.getByRole('dialog', { name: 'Dictionary' });
    expect(screen.getByText('S1 0.1.0, approved 16 October 2026. It changes only by migration.')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Shape' })).toBeTruthy();
    expect(screen.getByText('Round only')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect((sheet as HTMLDialogElement).open).toBe(false));
  });

  it('closes the Dictionary sheet with Escape, and opens it again', async () => {
    renderPage(async () => dictionary);
    fireEvent.click(await screen.findByRole('button', { name: 'Dictionary' }));
    const sheet = screen.getByRole('dialog', { name: 'Dictionary' }) as HTMLDialogElement;

    // Escape makes the browser close a modal <dialog>; happy-dom has no Escape, so do what the browser does.
    act(() => sheet.close());

    expect(screen.queryByRole('dialog', { name: 'Dictionary' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dictionary' }));
    expect(screen.getByRole('dialog', { name: 'Dictionary' })).toBeTruthy();
  });

  it('shows the reason it failed, and tries again on request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi
      .fn<AtlasGateway['dictionary']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(dictionary);
    renderPage(load);

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
