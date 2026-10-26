import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { savedFor, ILLUSTRATIVE } from '../../application/testing/atlas-fixtures';
import { COPIED_MS } from './CopyCodeButton';
import { SpecIdCard } from './SpecIdCard';
import { SpecIdSummary } from './SpecIdSummary';
import { StageIcons } from './StageIcons';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => reduced.value,
}));
afterEach(() => {
  reduced.value = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const row = () => within(screen.getByRole('list', { name: 'Manufacturer stages' }));

function Reached() {
  const { pathname } = useLocation();
  return <p>{pathname}</p>;
}

describe('StageIcons', () => {
  it('names each icon with its words, shown on hover and to a screen reader, and lights those reached', () => {
    render(<StageIcons counts={{ specificationsReceived: 2, quoted: 2, sampling: 1, inProduction: 0 }} />);

    const items = row().getAllByRole('listitem');
    expect(items.map((item) => [item.getAttribute('aria-label'), item.getAttribute('title'), item.getAttribute('data-lit')])).toEqual([
      ['Specifications received: 2 manufacturers', null, 'true'],
      ['Quoted: 2 manufacturers', null, 'true'],
      ['Sampling: 1 manufacturer', null, 'true'],
      ['In production: none', null, 'false'],
      ['2 manufacturers recorded', null, 'false'],
    ]);
    for (const item of items) expect(within(item).getByText(item.getAttribute('aria-label')!)).toBeTruthy();
    expect(items[0]?.className).toContain('text-accent-ink');
    expect(items[3]?.className).toContain('text-ink-subtle');
  });

  it('lights only the fifth for a Spec ID with no manufacturers', () => {
    render(<StageIcons counts={{ specificationsReceived: 0, quoted: 0, sampling: 0, inProduction: 0 }} />);

    expect(row().getAllByRole('listitem').filter((item) => item.getAttribute('data-lit') === 'true').map((item) => item.getAttribute('aria-label'))).toEqual([
      'No manufacturers yet',
    ]);
  });

  it('plays nothing for people who reduce motion', () => {
    reduced.value = true;

    render(<StageIcons counts={{ specificationsReceived: 1, quoted: 1, sampling: 0, inProduction: 0 }} />);

    expect(screen.getByRole('list', { name: 'Manufacturer stages' }).getAttribute('data-motion')).toBe('off');
  });
});

describe('SpecIdSummary with stage icons', () => {
  it('shows the row after the facts, and mounts it again on each hover to replay', () => {
    const saved = savedFor(ILLUSTRATIVE, 'Invented lid', {
      manufacturerStages: { specificationsReceived: 1, quoted: 1, sampling: 0, inProduction: 0 },
    });
    render(<SpecIdSummary saved={saved} />);

    const before = screen.getByRole('list', { name: 'Manufacturer stages' });
    fireEvent.mouseEnter(screen.getByText('Invented lid').closest('div')!.parentElement!);
    expect(screen.getByRole('list', { name: 'Manufacturer stages' })).not.toBe(before);
  });

  it('opens the manufacturers page when a stage icon is clicked', () => {
    const saved = savedFor(ILLUSTRATIVE, 'Invented lid', {
      manufacturerStages: { specificationsReceived: 1, quoted: 0, sampling: 0, inProduction: 0 },
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<SpecIdCard saved={saved} />} />
          <Route path="/atlas/:id/manufacturers" element={<Reached />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Specifications received: 1 manufacturer'));

    expect(screen.getByText(`/atlas/${saved.id}/manufacturers`)).toBeTruthy();
  });

  it('shows no row for a Spec ID from an API that sends no stages', () => {
    render(<SpecIdSummary saved={savedFor(ILLUSTRATIVE, 'Invented lid')} />);

    expect(screen.queryByRole('list', { name: 'Manufacturer stages' })).toBeNull();
  });

  it('copies the code, reads "Copied", and reads "Copy code" again after 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<SpecIdSummary saved={savedFor(ILLUSTRATIVE, 'Invented lid')} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(writeText).toHaveBeenCalledWith(ILLUSTRATIVE);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(COPIED_MS - 1));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(COPIED_MS).toBe(2000);
  });

  it('leaves the code selectable when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('refused'))) },
    });
    render(<SpecIdSummary saved={savedFor(ILLUSTRATIVE, 'Invented lid')} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(screen.getByText(ILLUSTRATIVE)).toBeTruthy();
  });
});
