import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider } from '@/features/accounts';
import { QuotationsGatewayProvider, type QuotationsGateway } from '@/features/atlas';
import { BEN, quotationFor, quotationsGatewayWith } from '@/features/atlas/application/testing/quotation-fixtures';
import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
import { QuotationChangesPage } from './QuotationChangesPage';
import { QuotationChangesPageSkeleton } from './QuotationChangesPageSkeleton';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

function renderPage(quotations: QuotationsGateway, isAdmin = true) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={fakeAccountsGateway({ me: async () => account({ isAdmin }) })}>
        <QuotationsGatewayProvider gateway={quotations}>
          <MemoryRouter>
            <RouteBoundary skeleton={<QuotationChangesPageSkeleton />}>
              <QuotationChangesPage />
            </RouteBoundary>
          </MemoryRouter>
        </QuotationsGatewayProvider>
      </AccountsGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('QuotationChangesPage (plan 0017)', () => {
  it('lists the waiting quotations, each naming and linking to the Spec ID it quotes, for an admin to decide', async () => {
    renderPage(quotationsGatewayWith({ list: async (state) => (state === 'waiting' ? [quotationFor()] : []) }));

    const card = within(await screen.findByRole('region', { name: 'Acme Packaging' }));
    expect(card.getByRole('link', { name: 'Invented PP cup A5B3' }).getAttribute('href')).toBe('/atlas/00000000-0000-4000-8000-000000000001/manufacturers');
    expect(card.getByRole('button', { name: 'Approve' })).toBeTruthy();
    // The time is the viewer's own: only who added it is certain here.
    expect(card.getByText(/^Added by Ada Invented, 6 November 2026/)).toBeTruthy();
  });

  it('says when none waits, and shows the history with each decision and its trail', async () => {
    const rejected = quotationFor({ state: 'rejected', decidedBy: BEN, decidedAt: new Date('2026-11-06T09:00:00.000Z'), reason: 'Per thousand.' });
    const get = vi.fn<QuotationsGateway['get']>(async () => ({
      ...rejected,
      trail: [
        { kind: 'suggested', by: { id: 'ada', fullName: 'Ada Invented' }, at: new Date('2026-11-06T08:00:00.000Z'), reason: null },
        { kind: 'rejected', by: BEN, at: new Date('2026-11-06T09:00:00.000Z'), reason: 'Per thousand.' },
      ],
    }));
    renderPage(quotationsGatewayWith({ list: async (state) => (state === 'waiting' ? [] : [rejected]), get }));

    expect(await screen.findByText('No quotations waiting.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'History' }));
    const card = within(await screen.findByRole('region', { name: 'Acme Packaging' }));
    expect(card.getByText('Rejected by Ben Invented: Per thousand.')).toBeTruthy();
    expect(card.queryByRole('button', { name: 'Approve' })).toBeNull();

    fireEvent.click(card.getByRole('button', { name: 'Show trail' }));
    const trail = within(await card.findByRole('list', { name: 'Trail' }));
    expect(trail.getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      expect.stringContaining('Added by Ada Invented'),
      expect.stringContaining('Rejected by Ben Invented'),
    ]);
  });

  it('offers staff no way to decide one', async () => {
    renderPage(quotationsGatewayWith({ list: async (state) => (state === 'waiting' ? [quotationFor()] : []) }), false);

    const card = within(await screen.findByRole('region', { name: 'Acme Packaging' }));
    expect(card.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(card.getByText('Waiting for an admin')).toBeTruthy();
  });
});
