import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AtlasGatewayProvider, type AtlasDictionary, type AtlasGateway, type SavedSpecId } from '@/features/atlas';
import { AppError } from '@/shared/application/app-error';
import { SpecIdPage } from './SpecIdPage';
import { SpecIdPageSkeleton } from './SpecIdPageSkeleton';

const ID = '00000000-0000-4000-8000-000000000001';
const dictionary: AtlasDictionary = { release: 'S1 0.1.0', approvedOn: '2026-10-16', slots: [], rules: [] };
const saved: SavedSpecId = {
  id: ID,
  code: 'S1.BLD',
  dictionaryRelease: 'S1 0.1.0',
  slots: [],
  name: 'Illustrative lid',
  savedBy: { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' },
  savedAt: new Date('2026-10-16T08:00:00Z'),
  version: 1,
  updatedBy: null,
  updatedAt: null,
};
const NOT_FOUND = new AppError('SPEC_ID_NOT_FOUND', "This Spec ID doesn't exist. It may have been typed wrong.");

function renderAt(path: string, getSaved: AtlasGateway['getSaved'], state?: unknown) {
  const pending = () => new Promise<never>(() => undefined);
  const gateway: AtlasGateway = {
    dictionary: async () => dictionary,
    decode: pending,
    encode: pending,
    save: pending,
    findByCode: pending,
    findSimilar: pending,
    readText: pending,
    getSaved,
    update: pending,
    history: pending,
    manufacturers: pending,
    setManufacturerStage: pending,
    library: pending,
  };
  const router = createMemoryRouter(
    [
      {
        path: '/atlas/:id',
        element: (
          <RouteBoundary skeleton={<SpecIdPageSkeleton />}>
            <SpecIdPage />
          </RouteBoundary>
        ),
      },
    ],
    { initialEntries: [{ pathname: path, state }] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AtlasGatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('SpecIdPage', () => {
  it('shows its skeleton while the Spec ID loads', () => {
    renderAt(`/atlas/${ID}`, () => new Promise(() => undefined));
    expect(screen.getByRole('status', { name: 'Loading Spec ID' })).toBeTruthy();
  });

  it('opens the saved Spec ID its address names', async () => {
    const getSaved = vi.fn(async () => saved);
    renderAt(`/atlas/${ID}`, getSaved);
    expect(await screen.findByRole('heading', { level: 1, name: 'Illustrative lid' })).toBeTruthy();
    expect(getSaved).toHaveBeenCalledWith(ID);
  });

  it('shows the message a save left on the way here', async () => {
    renderAt(`/atlas/${ID}`, async () => saved, { notice: 'Saved S1.BLD as "Illustrative lid".' });
    expect(await screen.findByText('Saved S1.BLD as "Illustrative lid".')).toBeTruthy();
  });

  it('says plainly when no Spec ID has the address, with the way back', async () => {
    renderAt('/atlas/not-a-uuid', async () => Promise.reject(NOT_FOUND));
    expect(
      await screen.findByRole('heading', { level: 1, name: "This Spec ID doesn't exist. It may have been typed wrong." }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Atlas' }).getAttribute('href')).toBe('/atlas');
  });

  it('sends any other failure to the route boundary', async () => {
    renderAt(`/atlas/${ID}`, async () =>
      Promise.reject(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.')),
    );
    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
  });
});
