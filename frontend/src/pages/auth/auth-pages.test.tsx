import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AccountsGatewayProvider, type AccountsGateway } from '@/features/accounts';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
import { ChangePasswordPage } from './ChangePasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SignInPage } from './SignInPage';
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

describe('SignInPage', () => {
  it('is bare: no navigation, the logo and a form', () => {
    renderPage('/sign-in', <SignInPage />, '/sign-in', fakeAccountsGateway());
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('img', { name: 'Source One' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
  });

  it('goes to the page it was asked for after signing in', async () => {
    const signIn = vi.fn<AccountsGateway['signIn']>().mockResolvedValue(account());
    const router = renderPage('/sign-in?next=%2Faccounts', <SignInPage />, '/sign-in', fakeAccountsGateway({ signIn }));
    type('Email', 'ada@sourceone.global');
    type('Password', 'a long enough password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts'));
    expect(signIn).toHaveBeenCalledWith({ email: 'ada@sourceone.global', password: 'a long enough password' });
  });

  it('goes home when there is no next, or it points off the site', async () => {
    const router = renderPage(
      '/sign-in?next=https%3A%2F%2Fevil.example',
      <SignInPage />,
      '/sign-in',
      fakeAccountsGateway(),
    );
    type('Email', 'ada@sourceone.global');
    type('Password', 'a long enough password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('shows why it was refused, exactly', async () => {
    const signIn = vi
      .fn<AccountsGateway['signIn']>()
      .mockRejectedValue(new AppError('SIGN_IN_FAILED', "That email and password don't match."));
    renderPage('/sign-in', <SignInPage />, '/sign-in', fakeAccountsGateway({ signIn }));
    type('Email', 'ada@sourceone.global');
    type('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe("That email and password don't match.");
  });
});

describe('SignUpPage', () => {
  it('says the account waits for approval', async () => {
    const signUp = vi.fn<AccountsGateway['signUp']>().mockResolvedValue(account({ status: 'pending' }));
    renderPage('/sign-up', <SignUpPage />, '/sign-up', fakeAccountsGateway({ signUp }));
    type('Email', 'ada@sourceone.global');
    type('Full name', 'Ada Lovelace');
    type('Password', 'a long enough password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Account created. reyxdz needs to approve it before you can sign in.'),
    ).toBeTruthy();
    expect(signUp).toHaveBeenCalledWith({
      email: 'ada@sourceone.global',
      fullName: 'Ada Lovelace',
      password: 'a long enough password',
    });
  });

  it('puts a field error beside its input', async () => {
    const signUp = vi.fn<AccountsGateway['signUp']>().mockRejectedValue(
      new AppError('VALIDATION_FAILED', 'Use at least 12 characters.', { password: ['Use at least 12 characters.'] }),
    );
    renderPage('/sign-up', <SignUpPage />, '/sign-up', fakeAccountsGateway({ signUp }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('Use at least 12 characters.')).toBeTruthy();
    // Said once, beside the input: not repeated in an alert.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error that belongs to no field as an alert', async () => {
    const message = 'Too many accounts were created from here. Try again in an hour.';
    const signUp = vi.fn<AccountsGateway['signUp']>().mockRejectedValue(new AppError('SIGN_UP_RATE_LIMITED', message));
    renderPage('/sign-up', <SignUpPage />, '/sign-up', fakeAccountsGateway({ signUp }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });
});

describe('ResetPasswordPage', () => {
  it('sets the new password with the token from the link, then goes to sign in', async () => {
    const resetPassword = vi.fn<AccountsGateway['resetPassword']>().mockResolvedValue(undefined);
    const router = renderPage(
      '/reset-password?token=abc123',
      <ResetPasswordPage />,
      '/reset-password',
      fakeAccountsGateway({ resetPassword }),
    );
    type('New password', 'a brand new password');
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
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