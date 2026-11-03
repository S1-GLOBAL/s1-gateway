import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { gatewayWith } from '../application/testing/atlas-fixtures';
import { ReviewSheetButton } from './ReviewSheetButton';

function renderButton(reviewSheet: AtlasGateway['reviewSheet']) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AtlasGatewayProvider gateway={gatewayWith({ reviewSheet })}>
        <ReviewSheetButton />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('ReviewSheetButton (plan 0014)', () => {
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

  it("asks for the review sheet and saves it dated by the reader's own day, not the server's", async () => {
    // 05:00 on 4 November in the reader's zone; the server, in UTC, may still say the 3rd.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 4, 5, 0) });
    const reviewSheet = vi.fn(async () => ({ fileName: 'atlas-review-2026-11-03.xlsx', file: new Blob(['PK']) }));
    renderButton(reviewSheet);

    fireEvent.click(screen.getByRole('button', { name: 'Review sheet' }));

    await waitFor(() => expect(clicked).toEqual([{ href: 'blob:review', download: 'atlas-review-2026-11-04.xlsx' }]));
    expect(reviewSheet).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:review');
  });

  it('says beside the button when the sheet could not be made, and saves nothing', async () => {
    renderButton(async () => {
      throw new AppError('INTERNAL', 'Something went wrong.');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review sheet' }));

    expect((await screen.findByRole('alert')).textContent).toBe('The review sheet could not be made. Try again.');
    expect(clicked).toEqual([]);
  });
});
