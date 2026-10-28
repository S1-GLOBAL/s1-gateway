import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsGatewayProvider, type AccountsGateway } from '@/features/accounts';
import { AtlasGatewayProvider, SuggestionsGatewayProvider, type AtlasGateway, type SuggestionsGateway } from '@/features/atlas';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { AppError } from '@/shared/application/app-error';
import { duration } from '@/shared/ui/motion';
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
  dictionary: async () => ({ release: 'S1 0.1.0', approvedOn: '2026-10-16', slots: [], rules: [], change: null }),
  decode: pending,
  encode: pending,
  save: pending,
  findByCode: pending,
  findSimilar: async () => ({ fits: [], mightFit: [] }),
  readText: pending,
  getSaved: async () => Promise.reject(new AppError('SPEC_ID_NOT_FOUND', "This Spec ID doesn't exist.")),
  update: pending,
  history: pending,
  manufacturers: pending,
  setManufacturerStage: pending,
  library: async () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
};

/** No suggestion waits, unless a test says otherwise. */
function suggestionsWith(overrides: Partial<SuggestionsGateway> = {}): SuggestionsGateway {
  return {
    suggest: pending,
    edit: pending,
    usage: async () => 0,
    list: async () => [],
    get: pending,
    waitingCount: async () => 0,
    approve: pending,
    reject: pending,
    withdraw: pending,
    ...overrides,
  };
}

function renderAt(path: string, gateway: AccountsGateway = fakeAccountsGateway(), suggestions = suggestionsWith()) {
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
            <SuggestionsGatewayProvider gateway={suggestions}>
              <RouterProvider router={router} />
            </SuggestionsGatewayProvider>
          </AtlasGatewayProvider>
        </AccountsGatewayProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}

/**
 * The page stays out of the accessibility tree until the curtain has left
 * (rise, hold, rise away). findByRole gives up after 3 seconds, and the
 * curtain is still leaving then, so a door page waits longer.
 */
const doorLeft = { timeout: (duration.curtain * 2 + duration.curtainHold) * 1000 + 1_000 };

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

  it(
    'opens the workspace for a new Spec ID at /atlas/new, never as an id',
    async () => {
      renderAt('/atlas/new');
      expect(await screen.findByRole('heading', { level: 1, name: 'New Spec ID' }, { timeout: 15_000 })).toBeTruthy();
    },
    20_000,
  );

  it(
    'says a Spec ID address that is not one does not exist, never a failure',
    async () => {
      renderAt('/atlas/not-a-uuid');
      const sentence = "This Spec ID doesn't exist. It may have been typed wrong.";
      expect(await screen.findByRole('heading', { level: 1, name: sentence }, { timeout: 15_000 })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Back to Atlas' }).getAttribute('href')).toBe('/atlas');
    },
    20_000,
  );

  it('shows the signed-in name beside the sidebar collapse, and Sign out in the top bar', async () => {
    renderAt('/theme');
    const sidebar = await screen.findByRole('complementary', { name: 'Main' });
    expect(within(sidebar).getByText('Ada Lovelace')).toBeTruthy();
    expect(within(sidebar).getByText('ada@sourceone.global')).toBeTruthy();
    expect(within(sidebar).getByText('AL')).toBeTruthy();
    const signOut = await screen.findByRole('button', { name: 'Sign out' });
    const header = signOut.closest('header');
    if (!header) throw new Error('Sign out is not in the top bar');
    const theme = within(header).getByRole('radiogroup', { name: 'Theme' });
    expect(theme.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(signOut.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-surface', 'border-border-strong', 'shadow-sm']));
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
    expect(await screen.findByRole('heading', { level: 1, name: 'Internal tools in one place.' }, doorLeft)).toBeTruthy();
  });
});

describe('the sign-in gate', () => {
  it('draws the shell and the Atlas skeleton while the session is still loading', async () => {
    renderAt('/atlas', fakeAccountsGateway({ me: () => new Promise<never>(() => undefined) }));
    expect(await screen.findByRole('status', { name: 'Loading Atlas' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Atlas' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('draws the change-password form, not the shell, while the session is still loading', async () => {
    renderAt('/change-password', fakeAccountsGateway({ me: () => new Promise<never>(() => undefined) }));
    expect(await screen.findByRole('status', { name: 'Loading the page' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('sends someone signed out to the landing, remembering where they were going', async () => {
    const router = renderAt('/theme', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Internal tools in one place.' }, doorLeft)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?next=%2Ftheme');
    // First visit — never had a session in this tab — so no "session ended" notice.
    expect(screen.queryByText('Your session ended. Sign in again.')).toBeNull();
  });

  it('says the session ended when this tab had been signed in before', async () => {
    sessionStorage.setItem('s1_gateway.had_session', '1');
    const router = renderAt('/theme', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Internal tools in one place.' }, doorLeft)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
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
    expect(await screen.findByRole('button', { name: 'Try again' }, doorLeft)).toBeTruthy();
    expect(screen.getByText('The Gateway is temporarily unavailable.')).toBeTruthy();
    expect(screen.queryByText('The Gateway could not check your sign-in.')).toBeNull();
  });

  it('shows the branded landing when signed out at /', async () => {
    const router = renderAt('/', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Internal tools in one place.' }, doorLeft)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText('Create an account')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
  });

  it('signs in from the front door and opens Atlas', async () => {
    let signedIn = false;
    const signIn = vi.fn<AccountsGateway['signIn']>().mockImplementation(async () => {
      signedIn = true;
      return account();
    });
    const router = renderAt(
      '/',
      fakeAccountsGateway({
        signIn,
        me: async () => {
          if (!signedIn) throw SIGNED_OUT;
          return account();
        },
      }),
    );
    await screen.findByRole('button', { name: 'Sign in' }, doorLeft);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@sourceone.global' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long enough password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/atlas'));
    expect(signIn).toHaveBeenCalledWith({ email: 'ada@sourceone.global', password: 'a long enough password' });
  });

  it('returns to the page it was asked for after signing in', async () => {
    let signedIn = false;
    const signIn = vi.fn<AccountsGateway['signIn']>().mockImplementation(async () => {
      signedIn = true;
      return account();
    });
    const router = renderAt(
      '/?next=%2Ftheme',
      fakeAccountsGateway({
        signIn,
        me: async () => {
          if (!signedIn) throw SIGNED_OUT;
          return account();
        },
      }),
    );
    await screen.findByRole('button', { name: 'Sign in' }, doorLeft);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@sourceone.global' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long enough password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/theme'));
  });

  it('opens Atlas when next points off the site', async () => {
    let signedIn = false;
    const router = renderAt(
      '/?next=https%3A%2F%2Fevil.example',
      fakeAccountsGateway({
        signIn: async () => {
          signedIn = true;
          return account();
        },
        me: async () => {
          if (!signedIn) throw SIGNED_OUT;
          return account();
        },
      }),
    );
    await screen.findByRole('button', { name: 'Sign in' }, doorLeft);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@sourceone.global' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a long enough password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/atlas'));
  });

  it('shows why sign-in was refused, exactly', async () => {
    const signIn = vi
      .fn<AccountsGateway['signIn']>()
      .mockRejectedValue(new AppError('SIGN_IN_FAILED', "That email and password don't match."));
    renderAt('/', fakeAccountsGateway({ signIn, me: async () => Promise.reject(SIGNED_OUT) }));
    await screen.findByRole('button', { name: 'Sign in' }, doorLeft);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@sourceone.global' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe("That email and password don't match.");
  });

  it('sends an old /sign-in address to the landing form, keeping the return path', async () => {
    const router = renderAt(
      '/sign-in?next=%2Ftheme',
      fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Internal tools in one place.' }, doorLeft)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?next=%2Ftheme');
  });

  it('keeps the public pages open without a session', async () => {
    renderAt('/sign-up', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Gateway is invite-only.' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('keeps the front door up until the session check settles', async () => {
    let rejectSession: (error: unknown) => void = () => undefined;
    const pending = new Promise<never>((_resolve, reject) => {
      rejectSession = reject;
    });
    const me = vi.fn<AccountsGateway['me']>(() => pending);
    renderAt('/', fakeAccountsGateway({ me }));

    expect(await screen.findByRole('status', { name: 'Source One' })).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();

    rejectSession(SIGNED_OUT);
    expect(await screen.findByLabelText('Email')).toBeTruthy();
  });

  it('keeps the registration curtain up until the invite has loaded', async () => {
    let resolveInvite: (invite: { email: string; expiresAt: Date }) => void = () => undefined;
    const pending = new Promise<{ email: string; expiresAt: Date }>((resolve) => {
      resolveInvite = resolve;
    });
    const getInvite = vi.fn<AccountsGateway['getInvite']>(() => pending);
    renderAt('/register?token=tok', fakeAccountsGateway({ getInvite, me: async () => Promise.reject(SIGNED_OUT) }));

    expect(await screen.findByRole('status', { name: 'Source One Internal Registration' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Create your account' })).toBeNull();

    resolveInvite({ email: 'ada@sourceone.global', expiresAt: new Date('2026-10-23T08:00:00.000Z') });
    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' }, doorLeft)).toBeTruthy();
  });

  it('opens an invite link without a session, outside the shell', async () => {
    const router = renderAt('/register?token=tok', fakeAccountsGateway({ me: async () => Promise.reject(SIGNED_OUT) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Create your account' }, doorLeft)).toBeTruthy();
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
    ['staff', false, ['Atlas', 'Dictionary Changes', 'Theme']],
    ['an admin', true, ['Atlas', 'Dictionary Changes', 'Accounts', 'Theme']],
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

  it('shows an admin how many suggestions wait for them, in the sidebar and the bottom bar', async () => {
    renderAt('/theme', fakeAccountsGateway({ me: async () => account({ isAdmin: true }) }), suggestionsWith({ waitingCount: async () => 2 }));
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    const links = await screen.findAllByRole('link', { name: 'Dictionary Changes 2 suggestions waiting' });
    expect(links).toHaveLength(2);
  });

  it('never asks for a count for staff, who decide no suggestion', async () => {
    const waitingCount = vi.fn(async () => 2);
    renderAt('/theme', fakeAccountsGateway({ me: async () => account({ isAdmin: false }) }), suggestionsWith({ waitingCount }));
    await screen.findByRole('heading', { level: 1, name: 'Theme' });
    expect(screen.getAllByRole('link', { name: 'Dictionary Changes' })).toHaveLength(2);
    expect(waitingCount).not.toHaveBeenCalled();
  });
});
