import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { ToolsGatewayProvider, type Tool, type ToolsGateway } from '@/features/tools';
import { AppError } from '@/shared/application/app-error';
import { ToolsPage } from './ToolsPage';
import { ToolsPageSkeleton } from './ToolsPageSkeleton';

const payroll: Tool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: 'Monthly pay',
  category: 'Finance',
  createdAt: new Date(0),
};

function renderPage(list: ToolsGateway['list']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const gateway: ToolsGateway = { list, create: async () => payroll };
  render(
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={gateway}>
        <RouteBoundary skeleton={<ToolsPageSkeleton />}>
          <ToolsPage />
        </RouteBoundary>
      </ToolsGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('ToolsPage', () => {
  it('shows its skeleton while the tools load', () => {
    renderPage(() => new Promise(() => undefined));
    expect(screen.getByRole('status', { name: 'Loading tools' })).toBeTruthy();
  });

  it('lists the tools under their category', async () => {
    renderPage(async () => [payroll]);
    expect(await screen.findByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Finance' })).toBeTruthy();
  });

  it('says there are none yet, and offers to add one', async () => {
    renderPage(async () => []);
    expect(await screen.findByText('No tools yet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add tool' })).toHaveLength(2);
  });

  it('shows the reason it failed, and tries again on request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const list = vi
      .fn<ToolsGateway['list']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue([payroll]);
    renderPage(list);

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('opens the Add a tool sheet', async () => {
    renderPage(async () => [payroll]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add tool' }));
    expect(screen.getByRole('dialog', { name: 'Add a tool' })).toBeTruthy();
  });
});
