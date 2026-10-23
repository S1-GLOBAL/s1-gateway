import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savedFor, ILLUSTRATIVE } from '../../application/testing/atlas-fixtures';
import { SpecIdSummary } from './SpecIdSummary';
import { StageIcons } from './StageIcons';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => reduced.value,
}));
afterEach(() => {
  reduced.value = false;
});

const row = () => within(screen.getByRole('list', { name: 'Manufacturer stages' }));

describe('StageIcons', () => {
  it('names each icon with its words, as hover text and for a screen reader, and lights those reached', () => {
    render(<StageIcons counts={{ specificationsReceived: 2, quoted: 2, sampling: 1, inProduction: 0 }} />);

    const items = row().getAllByRole('listitem');
    expect(items.map((item) => [item.getAttribute('aria-label'), item.getAttribute('title'), item.getAttribute('data-lit')])).toEqual([
      ['Specifications received: 2 manufacturers', 'Specifications received: 2 manufacturers', 'true'],
      ['Quoted: 2 manufacturers', 'Quoted: 2 manufacturers', 'true'],
      ['Sampling: 1 manufacturer', 'Sampling: 1 manufacturer', 'true'],
      ['In production: none', 'In production: none', 'false'],
      ['2 manufacturers recorded', '2 manufacturers recorded', 'false'],
    ]);
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

  it('shows no row for a Spec ID from an API that sends no stages', () => {
    render(<SpecIdSummary saved={savedFor(ILLUSTRATIVE, 'Invented lid')} />);

    expect(screen.queryByRole('list', { name: 'Manufacturer stages' })).toBeNull();
  });
});
