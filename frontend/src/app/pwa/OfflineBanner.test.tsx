import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => setOnline(true));

describe('OfflineBanner', () => {
  it('shows nothing while online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says so when the connection drops, and goes away when it returns', () => {
    setOnline(true);
    render(<OfflineBanner />);

    act(() => setOnline(false));
    expect(screen.getByRole('status').textContent).toMatch(/offline/i);

    act(() => setOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
