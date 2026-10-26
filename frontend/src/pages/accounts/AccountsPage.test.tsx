import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider, type AccountLists, type AccountsGateway } from '@/features/accounts';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway, invite } from '@/test/fake-accounts-gateway';
import { AccountsPage } from './AccountsPage';
import { AccountsPageSkeleton } from './AccountsPageSkeleton';

const admin = account({ id: 'admin', fullName: 'Rey Admin', email: 'admin@sourceone.global', role: 'admin', isAdmin: true });
const systemAdmin = account({
  id: 'system',
  fullName: 'Sam System',
  email: 'system@sourceone.global',
  role: 'system-admin',
  isAdmin: true,
});
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
    expect(screen.getByText('No invites waiting.')).toBeTruthy();
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

  it('does not offer to disable yourself, or to change your own role', async () => {
    renderPage({ me: async () => systemAdmin, listAccounts: async () => ({ ...EMPTY, approved: [systemAdmin] }) });
    const row = (await (await section('Approved')).findByText('Sam System')).closest('li')!;
    expect(within(row).queryByRole('button', { name: 'Disable' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Reset password' })).toBeTruthy();
  });

  it('shows each admin and System Admin by their role', async () => {
    renderPage({ listAccounts: async () => ({ ...EMPTY, approved: [systemAdmin, admin, alan] }) });
    const approved = await section('Approved');
    expect((await approved.findByText('Sam System')).closest('li')!.textContent).toContain('System Admin');
    expect(approved.getByText('Rey Admin').closest('li')!.textContent).toContain('Admin');
    expect(approved.getByText('Alan Turing').closest('li')!.textContent).not.toContain('Admin');
  });

  it("offers an admin nothing on another admin's or a System Admin's account, and no role changes at all", async () => {
    const other = account({ id: 'admin-2', fullName: 'Ada Admin', role: 'admin', isAdmin: true });
    const disabledAdmin = account({ id: 'admin-3', fullName: 'Old Admin', role: 'admin', isAdmin: true, status: 'disabled' });
    renderPage({ listAccounts: async () => ({ ...EMPTY, approved: [admin, other, systemAdmin, alan], disabled: [disabledAdmin] }) });

    const approved = await section('Approved');
    for (const name of ['Ada Admin', 'Sam System']) {
      expect(within((await approved.findByText(name)).closest('li')!).queryAllByRole('button')).toEqual([]);
    }
    expect(within(approved.getByText('Alan Turing').closest('li')!).getByRole('button', { name: 'Disable' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change role' })).toBeNull();
    expect(within((await section('Disabled')).getByText('Old Admin').closest('li')!).queryAllByRole('button')).toEqual([]);
  });

  it('lets a System Admin make staff an admin, and says so', async () => {
    const setAccountRole = vi
      .fn<AccountsGateway['setAccountRole']>()
      .mockResolvedValue({ ...alan, role: 'admin', isAdmin: true });
    renderPage({
      me: async () => systemAdmin,
      listAccounts: async () => ({ ...EMPTY, approved: [systemAdmin, admin, alan] }),
      setAccountRole,
    });

    const row = (await (await section('Approved')).findByText('Alan Turing')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Change role' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Change role' }));
    expect(sheet.getByRole('button', { name: 'Save role' })).toHaveProperty('disabled', true);
    fireEvent.change(sheet.getByLabelText('Role'), { target: { value: 'admin' } });
    expect(sheet.getByText('Also invites people, and approves, disables and resets staff.')).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: 'Save role' }));

    expect(await screen.findByText('Alan Turing is now an admin.')).toBeTruthy();
    expect(setAccountRole).toHaveBeenCalledWith('a2', 'admin');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change role' })).toBeNull());
  });

  it('shows why a role change failed, in the sheet', async () => {
    const setAccountRole = vi
      .fn<AccountsGateway['setAccountRole']>()
      .mockRejectedValue(new AppError('NOT_ALLOWED', 'You are not allowed to do that.'));
    renderPage({ me: async () => systemAdmin, listAccounts: async () => ({ ...EMPTY, approved: [systemAdmin, admin] }), setAccountRole });

    const row = (await (await section('Approved')).findByText('Rey Admin')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Change role' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Change role' }));
    fireEvent.change(sheet.getByLabelText('Role'), { target: { value: 'staff' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Save role' }));

    expect((await sheet.findByRole('alert')).textContent).toBe('You are not allowed to do that.');
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

describe('AccountsPage invites', () => {
  const INVITE_URL = 'https://gateway.example/register?token=tok';

  async function openInviteForm() {
    fireEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    return within(screen.getByRole('dialog', { name: 'Invite' }));
  }

  it('creates an invite and shows its link once, in the exact words, ready to copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const createInvite = vi.fn<AccountsGateway['createInvite']>().mockResolvedValue({
      invite: invite({ email: 'grace@sourceone.global' }),
      inviteUrl: INVITE_URL,
    });
    renderPage({ createInvite });

    const form = await openInviteForm();
    expect(form.getByText('Their @sourceone.global address.')).toBeTruthy();
    fireEvent.change(form.getByLabelText('Email'), { target: { value: 'Grace@SourceOne.Global' } });
    fireEvent.click(form.getByRole('button', { name: 'Create invite link' }));

    const message = await screen.findByText(/^Invite link for grace@sourceone.global:/);
    expect(message.textContent).toBe(
      `Invite link for grace@sourceone.global: ${INVITE_URL}. Send it to them; it works once and expires in 7 days.`,
    );
    expect(createInvite).toHaveBeenCalledWith('Grace@SourceOne.Global');
    // The sheet closes in an effect, which may land just after the notice.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Invite' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(INVITE_URL);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/^Invite link for/)).toBeNull();
  });

  it.each([
    ['EMAIL_NOT_ALLOWED', 'Use a @sourceone.global email address.'],
    ['ACCOUNT_EXISTS', 'An account already exists for that email.'],
  ])('shows %s under Email, in its own words', async (code, message) => {
    const createInvite = vi
      .fn<AccountsGateway['createInvite']>()
      .mockRejectedValue(new AppError(code, message, { email: [message] }));
    renderPage({ createInvite });

    const form = await openInviteForm();
    fireEvent.change(form.getByLabelText('Email'), { target: { value: 'someone@example.com' } });
    fireEvent.click(form.getByRole('button', { name: 'Create invite link' }));

    await waitFor(() => expect(form.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true'));
    expect(form.getByText(message)).toBeTruthy();
    // Said once, beside the input: not repeated in an alert.
    expect(form.queryByRole('alert')).toBeNull();
  });

  it('lists each unused invite under Invited, with its expiry and Revoke', async () => {
    renderPage({ listInvites: async () => [invite({ email: 'grace@sourceone.global' })] });
    const row = (await (await section('Invited')).findByText('grace@sourceone.global')).closest('li')!;
    expect(within(row).getByText(/^Expires \d{1,2} October 2026$/)).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Revoke' })).toBeTruthy();
  });

  it('revokes an invite, says its link no longer works, and drops it from the list', async () => {
    const listInvites = vi
      .fn<AccountsGateway['listInvites']>()
      .mockResolvedValueOnce([invite({ id: 'i7', email: 'grace@sourceone.global' })])
      .mockResolvedValue([]);
    const revokeInvite = vi.fn<AccountsGateway['revokeInvite']>().mockResolvedValue(invite({ id: 'i7' }));
    renderPage({ listInvites, revokeInvite });

    fireEvent.click(await (await section('Invited')).findByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('The invite for grace@sourceone.global no longer works.')).toBeTruthy();
    expect(revokeInvite).toHaveBeenCalledWith('i7');
    expect(await screen.findByText('No invites waiting.')).toBeTruthy();
  });

  it('says so when the invite was already used or revoked', async () => {
    const revokeInvite = vi
      .fn<AccountsGateway['revokeInvite']>()
      .mockRejectedValue(new AppError('INVITE_NOT_FOUND', 'This invite was already used or revoked.'));
    renderPage({ listInvites: async () => [invite()], revokeInvite });

    fireEvent.click(await (await section('Invited')).findByRole('button', { name: 'Revoke' }));

    expect((await screen.findByRole('alert')).textContent).toBe('This invite was already used or revoked.');
  });
});