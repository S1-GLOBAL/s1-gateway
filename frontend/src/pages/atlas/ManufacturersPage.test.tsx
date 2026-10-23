import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider } from '@/features/accounts';
import { AtlasGatewayProvider, type AtlasGateway, type SpecIdManufacturers } from '@/features/atlas';
import { gatewayWith } from '@/features/atlas/application/testing/atlas-fixtures';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
import { ManufacturersPage } from './ManufacturersPage';
import { ManufacturersPageSkeleton } from './ManufacturersPageSkeleton';

const ID = '00000000-0000-4000-8000-000000000001';
const CODE = 'CUP.APP.Y.Y.RD.Y.Z0012.Y.Y.Y.X.X.X.Y.X.Y.Y.Y.X.X.X.X.X.X.X';

/** Invented: never a Source One manufacturer or price (ADR 0027). */
const list = (manufacturers: SpecIdManufacturers['manufacturers'] = []): SpecIdManufacturers => ({
  specId: { id: ID, name: 'Invented PP cup', code: CODE },
  manufacturers,
});
const acme: SpecIdManufacturers['manufacturers'][number] = {
  id: 'acme',
  name: 'Acme Packaging',
  country: 'Atlantis',
  stage: 'quoted',
  stageSet: null,
  quotes: [],
};

function renderAt(manufacturers: AtlasGateway['manufacturers'], isAdmin = false) {
  const router = createMemoryRouter(
    [
      {
        path: '/atlas/:id/manufacturers',
        element: (
          <RouteBoundary skeleton={<ManufacturersPageSkeleton />}>
            <ManufacturersPage />
          </RouteBoundary>
        ),
      },
    ],
    { initialEntries: [`/atlas/${ID}/manufacturers`] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={fakeAccountsGateway({ me: async () => account({ isAdmin }) })}>
        <AtlasGatewayProvider gateway={gatewayWith({ manufacturers })}>
          <RouterProvider router={router} />
        </AtlasGatewayProvider>
      </AccountsGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('ManufacturersPage', () => {
  it('shows its skeleton while the manufacturers load', () => {
    renderAt(() => new Promise(() => undefined));

    expect(screen.getByRole('status', { name: 'Loading Manufacturers' })).toBeTruthy();
  });

  it('shows the eyebrow, the name, its code, and Open Spec ID to the Spec ID page', async () => {
    renderAt(async () => list([acme]));

    expect(await screen.findByRole('heading', { level: 1, name: 'Invented PP cup' })).toBeTruthy();
    expect(screen.getByText('Manufacturers')).toBeTruthy();
    expect(screen.getByText(CODE)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Spec ID' }).getAttribute('href')).toBe(`/atlas/${ID}`);
    expect(screen.getByRole('region', { name: 'Quoted' })).toBeTruthy();
  });

  it('shows an admin the stage buttons', async () => {
    renderAt(async () => list([acme]), true);

    expect(await screen.findByRole('button', { name: 'Mark as sampling' })).toBeTruthy();
  });

  it('shows staff who are not admins no stage buttons', async () => {
    renderAt(async () => list([acme]), false);

    expect(await screen.findByRole('region', { name: 'Quoted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as sampling' })).toBeNull();
  });

  it('says no manufacturers are recorded yet, with the circle-slash and Open Spec ID', async () => {
    renderAt(async () => list());

    const title = await screen.findByText('No manufacturers are recorded for this Spec ID yet.');
    const empty = title.parentElement?.parentElement;
    expect(empty?.querySelector('circle')?.getAttribute('r')).toBe('10');
    expect(empty?.querySelector('line')?.getAttribute('x1')).toBe('9');
    expect(empty?.querySelector('line')?.getAttribute('y2')).toBe('9');
    expect(screen.getByText('They come from the verified list import.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Spec ID' }).map((link) => link.getAttribute('href'))).toContain(
      `/atlas/${ID}`,
    );
  });

  it("says the Spec ID doesn't exist for an id no Spec ID has", async () => {
    renderAt(async () => {
      throw new AppError('SPEC_ID_NOT_FOUND', "This Spec ID doesn't exist. It may have been typed wrong.");
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: "This Spec ID doesn't exist. It may have been typed wrong." }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Atlas' }).getAttribute('href')).toBe('/atlas');
  });

  it('shows the error with Try again when the manufacturers cannot load', async () => {
    renderAt(async () => {
      throw new AppError('INTERNAL_ERROR', 'Something went wrong. Try again later.');
    });

    expect(await screen.findByText('Something went wrong. Try again later.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
