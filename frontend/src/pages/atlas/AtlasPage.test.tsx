import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AtlasGatewayProvider, type AtlasDictionary, type AtlasGateway } from '@/features/atlas';
import { AppError } from '@/shared/application/app-error';
import { AtlasPage } from './AtlasPage';
import { AtlasPageSkeleton } from './AtlasPageSkeleton';

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const gateway: AtlasGateway = { dictionary: load, decode: () => new Promise(() => undefined) };
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <RouteBoundary skeleton={<AtlasPageSkeleton />}>
          <AtlasPage />
        </RouteBoundary>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('AtlasPage', () => {
  it('shows its skeleton while the dictionary loads', () => {
    renderPage(() => new Promise(() => undefined));
    expect(screen.getByRole('status', { name: 'Loading Atlas' })).toBeTruthy();
  });

  it('shows Decode and the Dictionary when it arrives', async () => {
    renderPage(async () => dictionary);
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' })).toBeTruthy();
    expect(
      screen.getByText('Read, build and save S1 Spec IDs: one code for what a product physically is.'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Decode' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Dictionary' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Decode' })).toBeTruthy();
    expect(screen.getByLabelText('Spec ID')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Shape' })).toBeTruthy();
    expect(screen.getByText('Round only')).toBeTruthy();
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
    expect(await screen.findByRole('heading', { level: 2, name: 'Dictionary' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
