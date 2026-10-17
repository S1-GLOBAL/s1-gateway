import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsGatewayProvider, type AccountsGateway } from '@/features/accounts';
import { AtlasGatewayProvider, type AtlasGateway } from '@/features/atlas';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway, SIGNED_OUT } from '@/test/fake-accounts-gateway';
import { routes } from './routes';

// The service worker's registration only exists in a Vite build.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  }),
}));

/** Atlas, where signed-in staff land: an empty dictionary and no saved Spec IDs. */
const pending = () => new Promise<never>(() => undefined);
const atlasGateway: AtlasGateway = {
  dictionary: async () => ({ release: 'S1 0.1.0', approvedOn: '2026-10-16', slots: [], rules: [] }),
  decode: pending,
  encode: pending,
  save: pending,
  findByCode: pending,
  findSimilar: async () => ({ fits: [], mightFit: [] }),
};

function renderAt(path: string, gateway: AccountsGateway = fakeAccountsGateway()) {
  const store: ThemePreferenceStore = { read: () => 'light', write: () => undefined };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: () => undefined,
    transition: (update) => update(),
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider store={store} document={document}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AccountsGatewayProvider gateway={gateway}>
          <AtlasGatewayProvider gateway={atlasGateway}>
            <RouterProvider router={router} />
          </AtlasGatewayProvider>
        </AccountsGatewayProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('the app, signed in', () => {
  it(
    'opens on Atlas, inside the shell',
    async () => {
      const router = renderAt('/');
      // Signed-in `/` hops through the landing Navigate before Atlas loads.
      expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' }, { timeout: 15_000 })).toBeTruthy();
      expect(router.state.location.pathname).toBe('/atlas');
      expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
      expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    },
    20_000,
  );

  it('has no Tools page and no Tools link', async () => {
    renderAt('/theme');
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('offers Atlas in the navigation', async () => {
    renderAt('/theme');
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    expect(screen.getAllByRole('link', { name: 'Atlas' }).length).toBeGreaterThan(0);
  });

  it("shows the destination's skeleton while it loads, then the page", async () => {
    renderAt('/theme');
    // Theme has no async gateway; the skeleton flashes then the heading appears.
    expect(await screen.findByRole('heading', { level: 1, name: 'Theme' })).toBeTruthy();
  });

  it('moves between places from the sidebar', async () => {
    const router = renderAt('/theme');
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    const [sidebarThemeLink] = screen.getAllByRole('link', { name: 'Theme' });
    fireEvent.click(sidebarThemeLink!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Theme' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/theme');
  });

  it('says plainly when an address does not exist, and offers Atlas', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'There is nothing at this address.' })).toBeTruthy();
    const note = screen.getByText(/It may have moved\./);
    expect(within(note).getByRole('link', { name: 'Atlas' }).getAttribute('href')).toBe('/atlas');
  });

  it('shows the signed-in name and Sign out in the top bar', async () => {
    renderAt('/theme');
    expect(await screen.findByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('signs out, and lands on the landing', async () => {
    let signedIn = true;
    const signOut = vi.fn<AccountsGateway['signOut']>().mockImplementation(async () => {
      signedIn = false;
    });
    const router = renderAt(
      '/theme',
      fakeAccountsGateway({
        signOut,
        me: async () => {
          if (!signedIn) throw SIGNED_OUT;
          return account();
        },
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { level: 1, name: "Source One's Staff Hub." })).toBeTruthy();
  });
});

describe('the sign-in gate', () => {
  it('sends someone signed out to /sign-in, remembering where they were going', async () => {
    const router = renderAt('/theme', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toBe('?next=%2Ftheme');
    // First visit — never had a session in this tab — so no "session ended" notice.
    expect(screen.queryByText('Your session ended. Sign in again.')).toBeNull();
  });

  it('says the session ended when this tab had been signed in before', async () => {
    sessionStorage.setItem('s1_gateway.had_session', '1');
    const router = renderAt('/theme', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(screen.getByText('Your session ended. Sign in again.')).toBeTruthy();
  });

  it('sends someone who must change their password to /change-password', async () => {
    const router = renderAt(
      '/theme',
      fakeAccountsGateway({ me: async () => account({ mustChangePassword: true }) }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Change your password' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/change-password');
    expect(screen.getByText('Choose a new password before you continue.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('shows the landing unavailable note when the check itself fails', async () => {
    const router = renderAt(
      '/theme',
      fakeAccountsGateway({
        me: async () => Promise.reject(new AppError('HTTP_502', 'No route for GET /api/v1/auth/me')),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('The Gateway is temporarily unavailable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('The Gateway could not check your sign-in.')).toBeNull();
  });

  it('shows the branded landing when signed out at /', async () => {
    const router = renderAt('/', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: "Source One's Staff Hub." })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText('Create an account')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
  });

  it('keeps the public pages open without a session', async () => {
    renderAt('/sign-up', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Gateway is invite-only.' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('opens an invite link without a session, outside the shell', async () => {
    const router = renderAt('/register?token=tok', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' })).toBeTruthy();
    expect(screen.getByText('ada@sourceone.global')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/register');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});

describe('navigation by role', () => {
  it('hides Accounts from staff', async () => {
    renderAt('/theme');
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();
  });

  it('shows Accounts to an admin', async () => {
    renderAt('/theme', fakeAccountsGateway({ me: async () => account({ isAdmin: true }) }));
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    expect(screen.getAllByRole('link', { name: 'Accounts' }).length).toBeGreaterThan(0);
  });

  it('opens Accounts for an admin', async () => {
    renderAt('/accounts', fakeAccountsGateway({ me: async () => account({ isAdmin: true }) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accounts' })).toBeTruthy();
  });

  it('sends staff away from /accounts to Atlas', async () => {
    const listAccounts = vi.fn<AccountsGateway['listAccounts']>();
    const router = renderAt('/accounts', fakeAccountsGateway({ listAccounts }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/atlas');
    expect(listAccounts).not.toHaveBeenCalled();
  });

  it.each([
    ['staff', false, ['Atlas', 'Theme']],
    ['an admin', true, ['Atlas', 'Accounts', 'Theme']],
  ] as const)('lists the places in order for %s, with Theme last', async (_who, isAdmin, labels) => {
    renderAt('/theme', fakeAccountsGateway({ me: async () => account({ isAdmin }) }));
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    // The sidebar's name is on its <aside>; the bottom bar's is on its <nav>.
    const sidebar = within(screen.getByRole('complementary', { name: 'Main' })).getByRole('navigation');
    const bottomBar = screen.getByRole('navigation', { name: 'Main' });
    for (const nav of [sidebar, bottomBar]) {
      expect(within(nav).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual(labels);
    }
  });
});