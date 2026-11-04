import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { gatewayWith } from '../application/testing/atlas-fixtures';
import { ReviewSheetActions } from './ReviewSheetActions';

/** An invented address: never the shared sheet's own. */
const SHARED_SHEET = 'https://docs.google.com/spreadsheets/d/invented-sheet/edit';

function renderActions(overrides: Partial<AtlasGateway>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AtlasGatewayProvider gateway={gatewayWith(overrides)}>
        <ReviewSheetActions />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('ReviewSheetActions (plan 0016)', () => {
  let clicked: { href: string; download: string }[];
  beforeEach(() => {
    clicked = [];
    URL.createObjectURL = vi.fn(() => 'blob:review');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the shared review sheet in a new tab', async () => {
    renderActions({ reviewSheetLink: async () => SHARED_SHEET });

    const link = await screen.findByRole('link', { name: 'Review sheet (opens in a new tab)' });

    expect(link.getAttribute('href')).toBe(SHARED_SHEET);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('offers no Review sheet until the host sets one, and still the Spec IDs', async () => {
    const reviewSheetLink = vi.fn(async () => null);
    renderActions({ reviewSheetLink });

    await waitFor(() => expect(reviewSheetLink).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /Review sheet/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Download Spec IDs' })).toBeTruthy();
  });

  it("downloads the Spec IDs sheet, dated by the reader's own day, not the server's", async () => {
    // 05:00 on 4 November in the reader's zone; the server, in UTC, may still say the 3rd.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 4, 5, 0) });
    const reviewSheet = vi.fn(async () => ({ fileName: 'atlas-spec-ids-2026-11-03.xlsx', file: new Blob(['PK']) }));
    renderActions({ reviewSheet });

    fireEvent.click(screen.getByRole('button', { name: 'Download Spec IDs' }));

    await waitFor(() => expect(clicked).toEqual([{ href: 'blob:review', download: 'atlas-spec-ids-2026-11-04.xlsx' }]));
    expect(reviewSheet).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:review');
  });

  it('says beside the buttons when the sheet could not be made, and saves nothing', async () => {
    renderActions({
      reviewSheet: async () => {
        throw new AppError('INTERNAL', 'Something went wrong.');
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download Spec IDs' }));

    expect((await screen.findByRole('alert')).textContent).toBe('The Spec IDs sheet could not be made. Try again.');
    expect(clicked).toEqual([]);
  });
});
