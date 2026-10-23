import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AccountsGatewayProvider, type AccountsGateway } from '@/features/accounts';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { LandingPage } from '@/pages/landing/LandingPage';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway, SIGNED_OUT } from '@/test/fake-accounts-gateway';
import { ChangePasswordPage } from './ChangePasswordPage';
import { RegisterPage } from './RegisterPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SignUpPage } from './SignUpPage';

function renderPage(path: string, element: RouteObject['element'], pagePath: string, gateway: AccountsGateway) {
  const routes: RouteObject[] = [
    { path: pagePath, element },
    { path: '*', element: <p>elsewhere</p> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </AccountsGatewayProvider>
    </QueryClientProvider>,
  );
  return router;
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('SignUpPage', () => {
  it('says only that the Gateway is invite-only: no form, no link onward', () => {
    renderPage('/sign-up', <SignUpPage />, '/sign-up', fakeAccountsGateway());
    expect(screen.getByRole('heading', { level: 1, name: 'The Gateway is invite-only.' })).toBeTruthy();
    expect(screen.getByText('Ask a Gateway admin for an invite link.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('RegisterPage', () => {
  const INVITED = 'ada@sourceone.global';
  const PASSWORD = 'a long enough password';

  /** The register page and the landing, so registering can be followed to the only sign-in form. */
  function renderRegister(path: string, gateway: AccountsGateway) {
    const store: ThemePreferenceStore = { read: () => 'light', write: () => undefined };
    const document: ThemeDocument = {
      prefersDark: () => false,
      subscribe: () => () => undefined,
      apply: () => undefined,
      transition: (update) => update(),
    };
    const router = createMemoryRouter(
      [
        { path: '/register', element: <RegisterPage /> },
        { path: '/', element: <LandingPage /> },
      ],
      { initialEntries: [path] },
    );
    render(
      <ThemeProvider store={store} document={document}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <AccountsGatewayProvider gateway={gateway}>
            <RouterProvider router={router} />
          </AccountsGatewayProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    return router;
  }

  function fillIn(confirmPassword = PASSWORD) {
    type('First name', 'Ada');
    type('Last name', 'Lovelace');
    type('Password', PASSWORD);
    type('Confirm password', confirmPassword);
  }

  it("shows the invite's email as text, not an input, and asks for four fields", async () => {
    const getInvite = vi
      .fn<AccountsGateway['getInvite']>()
      .mockResolvedValue({ email: INVITED, expiresAt: new Date('2026-10-23T08:00:00Z') });
    renderRegister('/register?token=tok', fakeAccountsGateway({ getInvite }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' })).toBeTruthy();
    expect(screen.getByText('You were invited to the Source One Gateway.')).toBeTruthy();
    expect(getInvite).toHaveBeenCalledWith('tok');
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText(INVITED).tagName).not.toBe('INPUT');
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByDisplayValue(INVITED)).toBeNull();
    for (const label of ['First name', 'Last name', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label).tagName).toBe('INPUT');
    }
    expect(screen.getByText('At least 12 characters.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });

  it("says the passwords don't match, under Confirm password, and sends nothing", async () => {
    const register = vi.fn<AccountsGateway['register']>();
    renderRegister('/register?token=tok', fakeAccountsGateway({ register }));
    await screen.findByLabelText('First name');

    fillIn('a different password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText("The passwords don't match.")).toBeTruthy();
    expect(screen.getByLabelText('Confirm password').getAttribute('aria-invalid')).toBe('true');
    expect(register).not.toHaveBeenCalled();
  });

  it("still shows the server's answer beside its input", async () => {
    const register = vi.fn<AccountsGateway['register']>().mockRejectedValue(
      new AppError('VALIDATION_FAILED', 'Use at most 40 characters.', { lastName: ['Use at most 40 characters.'] }),
    );
    renderRegister('/register?token=tok', fakeAccountsGateway({ register }));
    await screen.findByLabelText('First name');

    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByLabelText('Last name').getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('Use at most 40 characters.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error that belongs to no field as an alert', async () => {
    const message = 'This invite link no longer works.';
    const register = vi.fn<AccountsGateway['register']>().mockRejectedValue(new AppError('INVITE_INVALID', message));
    renderRegister('/register?token=tok', fakeAccountsGateway({ register }));
    await screen.findByLabelText('First name');

    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('says the link no longer works when the API answers 404 for its token', async () => {
    const getInvite = vi
      .fn<AccountsGateway['getInvite']>()
      .mockRejectedValue(new AppError('INVITE_INVALID', 'This invite link no longer works.'));
    renderRegister('/register?token=old', fakeAccountsGateway({ getInvite }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This invite link no longer works.' }),
    ).toBeTruthy();
    expect(
      screen.getByText('It may have expired, been used or been revoked. Ask a Gateway admin for a new one.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('First name')).toBeNull();
  });

  it('says the link no longer works when it has no token', async () => {
    const getInvite = vi.fn<AccountsGateway['getInvite']>();
    renderRegister('/register', fakeAccountsGateway({ getInvite }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This invite link no longer works.' }),
    ).toBeTruthy();
    expect(getInvite).not.toHaveBeenCalled();
  });

  it('registers, then lands on the front door with "Your account is ready. Sign in." and the email filled in', async () => {
    const register = vi.fn<AccountsGateway['register']>().mockResolvedValue(account({ email: INVITED }));
    const router = renderRegister(
      '/register?token=tok',
      fakeAccountsGateway({ register, me: async () => Promise.reject(SIGNED_OUT) }),
    );
    await screen.findByLabelText('First name');

    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(register).toHaveBeenCalledWith({
      token: 'tok',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(await screen.findByText('Your account is ready. Sign in.')).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(INVITED);
  });
});

describe('ResetPasswordPage', () => {
  it('sets the new password with the token from the link, then goes to the landing', async () => {
    const resetPassword = vi.fn<AccountsGateway['resetPassword']>().mockResolvedValue(undefined);
    const router = renderPage(
      '/reset-password?token=abc123',
      <ResetPasswordPage />,
      '/reset-password',
      fakeAccountsGateway({ resetPassword }),
    );
    type('New password', 'a brand new password');
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(resetPassword).toHaveBeenCalledWith({ token: 'abc123', newPassword: 'a brand new password' });
  });

  it('says the link is no good when there is no token', () => {
    renderPage('/reset-password', <ResetPasswordPage />, '/reset-password', fakeAccountsGateway());
    expect(screen.getByText('This link is invalid or has expired. Ask reyxdz for a new one.')).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('says the link is no good when the API refuses it', async () => {
    const message = 'This link is invalid or has expired. Ask reyxdz for a new one.';
    const resetPassword = vi
      .fn<AccountsGateway['resetPassword']>()
      .mockRejectedValue(new AppError('RESET_TOKEN_INVALID', message));
    renderPage('/reset-password?token=old', <ResetPasswordPage />, '/reset-password', fakeAccountsGateway({ resetPassword }));
    type('New password', 'a brand new password');
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });
});

describe('ChangePasswordPage', () => {
  it('asks for the current and the new password, then goes home', async () => {
    const changePassword = vi.fn<AccountsGateway['changePassword']>().mockResolvedValue(undefined);
    const router = renderPage(
      '/change-password',
      <ChangePasswordPage />,
      '/change-password',
      fakeAccountsGateway({ changePassword }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Change your password' })).toBeTruthy();
    type('Current password', 'the old password');
    type('New password', 'a brand new password');
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'the old password',
      newPassword: 'a brand new password',
    });
  });

  it('shows "That password is incorrect." beside the current password', async () => {
    const changePassword = vi.fn<AccountsGateway['changePassword']>().mockRejectedValue(
      new AppError('VALIDATION_FAILED', 'That password is incorrect.', {
        currentPassword: ['That password is incorrect.'],
      }),
    );
    renderPage('/change-password', <ChangePasswordPage />, '/change-password', fakeAccountsGateway({ changePassword }));
    await screen.findByRole('heading', { level: 1, name: 'Change your password' });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('That password is incorrect.')).toBeTruthy();
  });
});