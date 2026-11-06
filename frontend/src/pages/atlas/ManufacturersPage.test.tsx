import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider } from '@/features/accounts';
import { AtlasGatewayProvider, QuotationsGatewayProvider, type AtlasGateway, type QuotationsGateway, type SpecIdManufacturers } from '@/features/atlas';
import { gatewayWith } from '@/features/atlas/application/testing/atlas-fixtures';
import { BEN, quotationFor, quotationsGatewayWith } from '@/features/atlas/application/testing/quotation-fixtures';
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

function renderAt(manufacturers: AtlasGateway['manufacturers'], isAdmin = false, quotations: QuotationsGateway = quotationsGatewayWith()) {
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
          <QuotationsGatewayProvider gateway={quotations}>
            <RouterProvider router={router} />
          </QuotationsGatewayProvider>
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

  it('shows no button that changes a manufacturer stage, including for an admin', async () => {
    renderAt(async () => list([acme]), true);

    expect(await screen.findByRole('region', { name: 'Quoted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as sampling' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as in production' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear stage' })).toBeNull();
  });

  it('shows staff who are not admins no stage buttons', async () => {
    renderAt(async () => list([acme]), false);

    expect(await screen.findByRole('region', { name: 'Quoted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as sampling' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as in production' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear stage' })).toBeNull();
  });

  it('says no manufacturers are recorded yet, with the circle-slash and Open Spec ID', async () => {
    renderAt(async () => list());

    const title = await screen.findByText('No manufacturers are recorded for this Spec ID yet.');
    const empty = title.parentElement?.parentElement;
    expect(empty?.querySelector('circle')?.getAttribute('r')).toBe('10');
    expect(empty?.querySelector('line')?.getAttribute('x1')).toBe('9');
    expect(empty?.querySelector('line')?.getAttribute('y2')).toBe('9');
    expect(screen.getByText('They come from the verified list import, or from a quotation added here once an admin approves it.')).toBeTruthy();
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

describe('ManufacturersPage, quotations added in Atlas (plan 0017)', () => {
  /** The viewer, as `account()` makes them. */
  const ME = { id: 'a1', fullName: 'Ada Lovelace' };
  /** A quotation's card, in the section of those waiting: the manufacturer's own card below shares its name. */
  const waitingCard = async (name: string) =>
    within(within(await screen.findByRole('region', { name: 'Waiting for approval' })).getByRole('region', { name }));

  it('adds a quotation from a manufacturer already in Atlas, and says it waits for an admin', async () => {
    const add = vi.fn<QuotationsGateway['add']>(async () => quotationFor());
    renderAt(async () => list([acme]), false, quotationsGatewayWith({ add, manufacturers: async () => [{ id: 'acme', name: 'Acme Packaging', country: 'Atlantis' }] }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add quotation' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add quotation' }));
    await sheet.findByRole('option', { name: 'Acme Packaging (Atlantis)' });
    fireEvent.change(sheet.getByLabelText('Manufacturer'), { target: { value: 'acme' } });
    fireEvent.change(sheet.getByLabelText('FOB per unit (USD)'), { target: { value: '$0.0100' } });
    fireEvent.change(sheet.getByLabelText('Production lead time (optional)'), { target: { value: '30 days' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Add quotation' }));

    expect(await screen.findByText('Added. It waits for an admin to approve it.')).toBeTruthy();
    expect(add).toHaveBeenCalledWith(ID, { manufacturer: { id: 'acme' }, values: { fobPerUnit: '$0.0100', productionLeadTime: '30 days' } });
  });

  it('names a new manufacturer, and shows what the server refuses under its field', async () => {
    const add = vi.fn<QuotationsGateway['add']>(async () => {
      throw new AppError('VALIDATION_FAILED', 'The quotation is not valid.', { fobPerUnit: ['Give the FOB price per unit.'] });
    });
    renderAt(async () => list(), false, quotationsGatewayWith({ add }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add quotation' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add quotation' }));
    fireEvent.change(sheet.getByLabelText('Manufacturer'), { target: { value: 'new' } });
    fireEvent.change(sheet.getByLabelText('Company name'), { target: { value: 'Invented Cups Co' } });
    fireEvent.change(sheet.getByLabelText('Country'), { target: { value: 'Elsewhere' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Add quotation' }));

    expect(await sheet.findByText('Give the FOB price per unit.')).toBeTruthy();
    expect(add).toHaveBeenCalledWith(ID, { manufacturer: { name: 'Invented Cups Co', country: 'Elsewhere' }, values: {} });
  });

  it('lists the waiting quotations, which an admin who did not add one approves from the version read', async () => {
    const waiting = quotationFor({ version: 2, manufacturer: { kind: 'new', name: 'Invented Cups Co', country: 'Elsewhere' } });
    const approve = vi.fn<QuotationsGateway['approve']>(async () => ({ ...waiting, state: 'approved', decidedBy: BEN }));
    const listed = vi.fn<QuotationsGateway['list']>(async () => [waiting]);
    renderAt(async () => list([acme]), true, quotationsGatewayWith({ list: listed, approve }));

    const card = await waitingCard('Invented Cups Co');
    expect(screen.getByRole('region', { name: 'Waiting for approval' })).toBeTruthy();
    expect(card.getByText('New manufacturer')).toBeTruthy();
    expect(card.getByText('$0.0100')).toBeTruthy();
    expect(card.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(listed).toHaveBeenCalledWith('waiting', ID);
    fireEvent.click(card.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText("Approved. The quote from Invented Cups Co is now among the Spec ID's quotes.")).toBeTruthy();
    expect(approve).toHaveBeenCalledWith(waiting.id, 2);
  });

  it('rejects one with the reason typed', async () => {
    const waiting = quotationFor();
    const reject = vi.fn<QuotationsGateway['reject']>(async () => ({ ...waiting, state: 'rejected', decidedBy: BEN, reason: 'Per thousand.' }));
    renderAt(async () => list([acme]), true, quotationsGatewayWith({ list: async () => [waiting], reject }));

    fireEvent.click((await waitingCard('Acme Packaging')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Reject the quotation from Acme Packaging' }));
    fireEvent.change(sheet.getByLabelText('Reason'), { target: { value: 'Per thousand.' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Rejected. Ada Invented sees your reason.')).toBeTruthy();
    expect(reject).toHaveBeenCalledWith(waiting.id, 'Per thousand.');
  });

  it('lets whoever added one edit it in the same form, from the version read, or withdraw it; never decide it', async () => {
    const mine = quotationFor({ suggestedBy: ME, version: 3 });
    const edit = vi.fn<QuotationsGateway['edit']>(async () => ({ ...mine, version: 4 }));
    const withdraw = vi.fn<QuotationsGateway['withdraw']>(async () => ({ ...mine, state: 'withdrawn' }));
    renderAt(
      async () => list([acme]),
      true,
      quotationsGatewayWith({ list: async () => [mine], edit, withdraw, manufacturers: async () => [{ id: 'acme', name: 'Acme Packaging', country: null }] }),
    );

    const card = await waitingCard('Acme Packaging');
    expect(card.queryByRole('button', { name: 'Approve' })).toBeNull();
    fireEvent.click(card.getByRole('button', { name: 'Edit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit quotation' }));
    expect((sheet.getByLabelText('FOB per unit (USD)') as HTMLInputElement).value).toBe('$0.0100');
    fireEvent.change(sheet.getByLabelText('FOB per unit (USD)'), { target: { value: '$0.0120' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved. It still waits for an admin.')).toBeTruthy();
    expect(edit).toHaveBeenCalledWith(
      mine.id,
      expect.objectContaining({ manufacturer: { id: 'acme' }, values: expect.objectContaining({ fobPerUnit: '$0.0120', productionLeadTime: '30 days' }) }),
      3,
    );

    fireEvent.click(card.getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Withdrawn.')).toBeTruthy();
  });
});
