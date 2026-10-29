import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    dictionaryChange: null,
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
    dictionaryChange: null,
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
    dictionaryChange: null,
  },
];

function renderSheet(history: AtlasGateway['history'] = async () => HISTORY) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gatewayWith({ history })}>
        <MemoryRouter>
          <HistorySheet id={ID} name="Illustrative lid" open onClose={() => undefined} timeZone="UTC" />
        </MemoryRouter>
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

  it("names the dictionary change that made an entry, in #95's words, linking to the change", async () => {
    const byChange: SpecIdChange = {
      kind: 'updated',
      changedBy: ben,
      changedAt: new Date('2026-10-27T09:30:00Z'),
      codeBefore: 'S1.CODE.B',
      codeAfter: 'S1.CODE.C',
      nameBefore: 'Illustrative lid',
      nameAfter: 'Illustrative lid',
      slots: [{ key: 'material', name: 'Material', before: 'Polymer, PS', after: 'Polymer, invented', corrected: true }],
      dictionaryChange: { number: 3, suggestedBy: ada, approvedBy: ben },
    };
    renderSheet(async () => [byChange, ...HISTORY]);

    const line = 'Changed by dictionary change #3 — suggested by Ada Invented, approved by Ben Invented';
    const link = await screen.findByRole('link', { name: line });
    expect(link.textContent).toBe(line);
    expect(link.getAttribute('href')).toBe('/dictionary/changes?change=3');
    expect(screen.queryByText('Ben Invented updated 1 fact')).toBeNull();
  });

  it('shows a failure with Try again', async () => {
    renderSheet(async () => Promise.reject(new Error('Cannot reach the server.')));
    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
