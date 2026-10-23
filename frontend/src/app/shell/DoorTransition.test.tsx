import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { duration } from '@/shared/ui/motion';
import { DoorTransition } from './DoorTransition';
import { useDoorHold } from './door-hold';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => reduced.value,
}));

afterEach(() => {
  reduced.value = false;
  vi.useRealTimers();
});

function Screen({ waiting }: { waiting: boolean }) {
  useDoorHold(waiting);
  return <h1>The page</h1>;
}

function renderDoor(waiting: boolean) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <DoorTransition />,
        children: [{ index: true, element: <Screen waiting={waiting} /> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('the door curtain', () => {
  it('rises, stays still for 2 seconds even when the page is ready, then rises away', () => {
    expect(duration.curtainHold).toBe(2);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderDoor(false);

    const curtain = () => screen.getByRole('status', { name: 'Source One' });
    expect(curtain().getAttribute('data-phase')).toBe('enter');

    act(() => vi.advanceTimersByTime(duration.curtain * 1000 - 1));
    expect(curtain().getAttribute('data-phase')).toBe('enter');

    act(() => vi.advanceTimersByTime(1));
    expect(curtain().getAttribute('data-phase')).toBe('hold');

    act(() => vi.advanceTimersByTime(duration.curtainHold * 1000 - 1));
    expect(curtain().getAttribute('data-phase')).toBe('hold');

    act(() => vi.advanceTimersByTime(1));
    const leaving = document.querySelector('[data-phase="exit"]');
    expect(leaving?.getAttribute('aria-hidden')).toBe('true');

    act(() => vi.advanceTimersByTime(duration.curtain * 1000));
    expect(document.querySelector('.door-curtain')).toBeNull();
    expect(screen.getByRole('heading', { name: 'The page' })).toBeTruthy();
  });

  it('stays up past 2 seconds while the screen is not ready', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderDoor(true);

    act(() => vi.advanceTimersByTime((duration.curtain + duration.curtainHold) * 1000 + 1000));
    expect(screen.getByRole('status', { name: 'Source One' }).getAttribute('data-phase')).toBe('hold');
  });

  it('skips the rises when motion is reduced, and still holds for 2 seconds', () => {
    reduced.value = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderDoor(false);

    const curtain = screen.getByRole('status', { name: 'Source One' });
    expect(curtain.getAttribute('data-phase')).toBe('hold');
    expect(curtain.getAttribute('style')).toBeNull();

    act(() => vi.advanceTimersByTime(duration.curtainHold * 1000 - 1));
    expect(screen.getByRole('status', { name: 'Source One' })).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector('.door-curtain')).toBeNull();
  });
});
