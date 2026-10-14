import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { ToolsGatewayProvider, type ToolsGateway } from '@/features/tools';
import { routes } from './routes';

// The service worker's registration only exists in a Vite build.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  }),
}));

function renderAt(path: string, list: ToolsGateway['list'] = async () => []) {
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
        <ToolsGatewayProvider gateway={{ list, create: async () => Promise.reject(new Error('unused')) }}>
          <RouterProvider router={router} />
        </ToolsGatewayProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}

describe('the app', () => {
  it('opens on Tools, inside the shell', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tools' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
  });

  it("shows the destination's skeleton while it loads, then the page", async () => {
    renderAt('/', () => new Promise(() => undefined));
    expect(await screen.findByRole('status', { name: 'Loading tools' })).toBeTruthy();
  });

  it('moves between places from the sidebar', async () => {
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    const [sidebarThemeLink] = screen.getAllByRole('link', { name: 'Theme' });
    fireEvent.click(sidebarThemeLink!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Theme' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/theme');
  });

  it('says plainly when an address does not exist', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'There is nothing at this address.' })).toBeTruthy();
  });
});
