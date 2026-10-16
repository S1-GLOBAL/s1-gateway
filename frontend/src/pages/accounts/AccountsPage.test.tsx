import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider, type AccountLists, type AccountsGateway } from '@/features/accounts';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
import { AccountsPage } from './AccountsPage';
import { AccountsPageSkeleton } from './AccountsPageSkeleton';

const admin = account({ id: 'admin', fullName: 'Rey Admin', email: 'admin@sourceone.global', isAdmin: true });
const grace = account({ id: 'g1', fullName: 'Grace Hopper', email: 'grace@sourceone.global', status: 'pending' });
const alan = account({ id: 'a2', fullName: 'Alan Turing', email: 'alan@sourceone.global' });
const edsger = account({ id: 'e1', fullName: 'Edsger Dijkstra', email: 'edsger@sourceone.global', status: 'disabled' });

const EMPTY: AccountLists = { pending: [], approved: [], disabled: [] };

function renderPage(overrides: Partial<AccountsGateway>) {
  const gateway = fakeAccountsGateway({ me: async () => admin, ...overrides });
  const router = createMemoryRouter(
    [
      {
        path: '/accounts',
        element: (
          <RouteBoundary skeleton={<AccountsPageSkeleton />}>
            <AccountsPage />
          </RouteBoundary>
        ),
      },
      { path: '/atlas', element: <p>atlas page</p> },
    ],
    { initialEntries: ['/accounts'] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </AccountsGatewayProvider>
    </QueryClientProvider>,
  );
  return router;
}

async function section(name: string) {
  return within(await screen.findByRole('region', { name: new RegExp(`^${name}`) }));
}

describe('AccountsPage', () => {
  it('shows its skeleton while the accounts load', () => {
    renderPage({ listAccounts: () => new Promise(() => undefined) });
    expect(screen.getByRole('status', { name: /Loading/ })).toBeTruthy();
  });

  it('says no one is waiting when pending is empty', async () => {
    renderPage({ listAccounts: async () => EMPTY });
    expect(await screen.findByText('No accounts are waiting for approval.')).toBeTruthy();
    expect(screen.getByText('No approved accounts.')).toBeTruthy();
    expect(screen.getByText('No disabled accounts.')).toBeTruthy();
  });

  it('sends someone who is not an admin to Atlas, without asking for the lists', async () => {
    const listAccounts = vi.fn<AccountsGateway['listAccounts']>();
    const router = renderPage({ me: async () => account({ isAdmin: false }), listAccounts });
    expect(await screen.findByText('atlas page')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/atlas');
    expect(listAccounts).not.toHaveBeenCalled();
  });

  it('lists people under Pending, Approved and Disabled', async () => {
    renderPage({ listAccounts: async () => ({ pending: [grace], approved: [admin, alan], disabled: [edsger] }) });
    expect(await (await section('Pending')).findByText('Grace Hopper')).toBeTruthy();
    expect((await section('Approved')).getByText('Alan Turing')).toBeTruthy();
    expect((await section('Disabled')).getByText('Edsger Dijkstra')).toBeTruthy();
  });

  it('approves, and says so', async () => {
    const listAccounts = vi
      .fn<AccountsGateway['listAccounts']>()
      .mockResolvedValueOnce({ pending: [grace], approved: [admin], disabled: [] })
      .mockResolvedValue({ pending: [], approved: [admin, { ...grace, status: 'approved' }], disabled: [] });
    const approveAccount = vi.fn<AccountsGateway['approveAccount']>().mockResolvedValue(grace);
    renderPage({ listAccounts, approveAccount });

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Grace Hopper can now sign in.')).toBeTruthy();
    expect(approveAccount).toHaveBeenCalledWith('g1');
    expect(await screen.findByText('No accounts are waiting for approval.')).toBeTruthy();
  });

  it('shows the reset link once, in the exact words, and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const createPasswordResetLink = vi.fn<AccountsGateway['createPasswordResetLink']>().mockResolvedValue({
      resetUrl: 'https://gateway.example/reset-password?token=tok',
      expiresAt: new Date(0),
    });
    renderPage({ listAccounts: async () => ({ ...EMPTY, approved: [admin, alan] }), createPasswordResetLink });

    const row = (await (await section('Approved')).findByText('Alan Turing')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Reset password' }));

    const message = await screen.findByText(/^Password reset link for Alan Turing:/);
    expect(message.textContent).toBe(
      'Password reset link for Alan Turing: https://gateway.example/reset-password?token=tok. Give it to them in person; it works once and expires in 24 hours.',
    );
    expect(createPasswordResetLink).toHaveBeenCalledWith('a2');

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith('https://gateway.example/reset-password?token=tok');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/^Password reset link for/)).toBeNull();
  });

  it('disables, and says the open session has ended', async () => {
    const disableAccount = vi.fn<AccountsGateway['disableAccount']>().mockResolvedValue(alan);
    renderPage({ listAccounts: async () => ({ ...EMPTY, approved: [admin, alan] }), disableAccount });

    const row = (await (await section('Approved')).findByText('Alan Turing')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    expect(
      await screen.findByText('Alan Turing can no longer sign in, and any open session has ended.'),
    ).toBeTruthy();
    expect(disableAccount).toHaveBeenCalledWith('a2');
  });

  it('does not offer to disable yourself', async () => {
    renderPage({ listAccounts: async () => ({ ...EMPTY, approved: [admin] }) });
    const row = (await (await section('Approved')).findByText('Rey Admin')).closest('li')!;
    expect(within(row).queryByRole('button', { name: 'Disable' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Reset password' })).toBeTruthy();
  });

  it('shows why an action failed', async () => {
    const approveAccount = vi
      .fn<AccountsGateway['approveAccount']>()
      .mockRejectedValue(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'));
    renderPage({ listAccounts: async () => ({ ...EMPTY, pending: [grace] }), approveAccount });
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cannot reach the server. Check your connection and try again.',
    );
  });

  it('shows the reason the list failed to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderPage({
      listAccounts: async () => Promise.reject(new AppError('NOT_ALLOWED', 'You are not allowed to do that.')),
    });
    expect(await screen.findByText('You are not allowed to do that.')).toBeTruthy();
  });
});