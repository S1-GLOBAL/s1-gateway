import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { gatewayWith } from '../application/testing/atlas-fixtures';
import type { SpecIdChange } from '../domain/atlas';
import { HistorySheet } from './HistorySheet';

const ID = '00000000-0000-4000-8000-000000000001';
const ada = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const ben = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

/** Newest first, as the server answers: a rename, a correction with a new fact, the creation. */
const HISTORY: SpecIdChange[] = [
  {
    kind: 'updated',
    changedBy: ben,
    changedAt: new Date('2026-10-17T15:00:00Z'),
    codeBefore: 'S1.CODE.B',
    codeAfter: 'S1.CODE.B',
    nameBefore: 'Lid',
    nameAfter: 'Illustrative lid',
    slots: [],
  },
  {
    kind: 'updated',
    changedBy: ben,
    changedAt: new Date('2026-10-17T14:32:00Z'),
    codeBefore: 'S1.CODE.A',
    codeAfter: 'S1.CODE.B',
    nameBefore: 'Lid',
    nameAfter: 'Lid',
    slots: [
      { key: 'height', name: 'Height', before: 'Not known', after: '62 mm', corrected: false },
      { key: 'unitWeight', name: 'Unit weight', before: '3.3 g', after: '3.5 g', corrected: true },
    ],
  },
  {
    kind: 'created',
    changedBy: ada,
    changedAt: new Date('2026-10-16T08:00:00Z'),
    codeBefore: null,
    codeAfter: 'S1.CODE.A',
    nameBefore: null,
    nameAfter: 'Lid',
    slots: [],
  },
];

function renderSheet(history: AtlasGateway['history'] = async () => HISTORY) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gatewayWith({ history })}>
        <HistorySheet id={ID} name="Illustrative lid" open onClose={() => undefined} timeZone="UTC" />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

const entries = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('HistorySheet', () => {
  it('lists every change newest first, with the creation last', async () => {
    renderSheet();
    expect(await screen.findByText('Ben Invented renamed it')).toBeTruthy();
    expect(entries().map((entry) => entry.querySelector('p')?.textContent)).toEqual([
      'Ben Invented renamed it',
      'Ben Invented updated 2 facts',
      'Ada Invented created it',
    ]);
    expect(screen.getByText('17 October 2026, 14:32')).toBeTruthy();
  });

  it('shows each slot old → new, and "Corrected" only where a known value was replaced', async () => {
    renderSheet();
    await screen.findByText('Ben Invented updated 2 facts');
    const [, corrected] = entries();

    expect(within(corrected!).getAllByText('Corrected')).toHaveLength(1);
    expect(within(corrected!).getByText('Unit weight').textContent).toContain('Corrected');
    expect(within(corrected!).getByText('Height').textContent).not.toContain('Corrected');
    expect(within(corrected!).getByText('3.3 g')).toBeTruthy();
    expect(within(corrected!).getByText('3.5 g')).toBeTruthy();
    expect(within(corrected!).getByText('S1.CODE.A')).toBeTruthy();
    expect(within(corrected!).getByText('S1.CODE.B')).toBeTruthy();
  });

  it('reads each change as old "to" new, with the arrow hidden as every icon is', async () => {
    renderSheet();
    await screen.findByText('Ben Invented updated 2 facts');
    const [, corrected] = entries();
    const change = within(corrected!).getByText('3.5 g').closest('dd') as HTMLElement;

    expect(change.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(change.querySelector('svg')?.hasAttribute('aria-label')).toBe(false);
    expect(within(change).getByText('to').className).toContain('sr-only');
  });

  it('counts each filter, and Facts hides a rename alone', async () => {
    renderSheet();
    await screen.findByText('Ben Invented renamed it');
    expect(screen.getByRole('radio', { name: 'All · 3' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Name · 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Facts · 1' }));

    expect(entries()).toHaveLength(1);
    expect(screen.queryByText('Ben Invented renamed it')).toBeNull();
    expect(screen.getByText('Ben Invented updated 2 facts')).toBeTruthy();
  });

  it('shows a failure with Try again', async () => {
    renderSheet(async () => Promise.reject(new Error('Cannot reach the server.')));
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
