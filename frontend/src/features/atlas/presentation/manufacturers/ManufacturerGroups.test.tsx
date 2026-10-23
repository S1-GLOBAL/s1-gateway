import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import { gatewayWith } from '../../application/testing/atlas-fixtures';
import type { ManufacturerQuote, SpecIdManufacturer } from '../../domain/atlas';
import { ManufacturerGroups } from './ManufacturerGroups';

const SPEC = '00000000-0000-4000-8000-000000000001';

/** Invented: never a Source One manufacturer, item or price (ADR 0027). */
const quote = (overrides: Partial<ManufacturerQuote> = {}): ManufacturerQuote => ({
  itemName: 'Invented PP cup, 12oz',
  fobPerUnit: '$0.0123',
  fobPerCase: '$12.30',
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: '7',
  productionLeadTime: '30-35 days',
  ...overrides,
});

const acme: SpecIdManufacturer = {
  id: 'acme',
  name: 'Acme Packaging',
  country: 'Atlantis',
  stage: 'quoted',
  stageSet: null,
  quotes: [quote(), quote({ itemName: 'Invented PP cup, 16oz' }), quote({ itemName: null })],
};
const borealis: SpecIdManufacturer = {
  id: 'borealis',
  name: 'Borealis Boxes',
  country: null,
  stage: 'sampling',
  stageSet: { by: { id: 'admin', fullName: 'Ada Admin' }, at: new Date('2026-10-23T08:00:00Z'), stage: 'sampling' },
  quotes: [quote({ fobPerUnit: 'N/A', fobPerCase: null })],
};

function renderGroups(isAdmin: boolean, overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith(overrides);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AtlasGatewayProvider gateway={gateway}>
        <ManufacturerGroups specId={SPEC} manufacturers={[acme, borealis]} isAdmin={isAdmin} timeZone="UTC" />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

const card = (name: string) => within(screen.getByRole('article', { name }));

describe('ManufacturerGroups', () => {
  it("shows each manufacturer once in its group, with its country, stage and every quote under #57's labels", () => {
    renderGroups(false);

    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual(['Quoted', 'Sampling']);
    const acmeCard = card('Acme Packaging');
    expect(acmeCard.getByText('Atlantis')).toBeTruthy();
    expect(acmeCard.getByText('Quoted')).toBeTruthy();
    expect(acmeCard.getAllByRole('listitem')).toHaveLength(3);
    expect(acmeCard.getByText('Invented PP cup, 16oz')).toBeTruthy();
    expect(acmeCard.getAllByText('FOB per unit (USD)')).toHaveLength(3);
    for (const label of ['FOB per case (USD)', 'FOB total (USD)', 'Mold cost', 'Sample lead time', 'Production lead time', 'Mold lead time']) {
      expect(acmeCard.getAllByText(label)).toHaveLength(3);
    }
    expect(acmeCard.getAllByText('7 days')).toHaveLength(3);
    expect(acmeCard.getAllByText('30-35 days')).toHaveLength(3);
    expect(acmeCard.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('says who set a stage, and when', () => {
    renderGroups(false);

    expect(card('Borealis Boxes').getByText('Set to Sampling by Ada Admin on 23 October 2026')).toBeTruthy();
    expect(card('Acme Packaging').queryByText(/^Set to/)).toBeNull();
  });

  it('shows staff who are not admins no stage buttons', () => {
    renderGroups(false);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an admin Mark as sampling and Mark as in production, and Clear stage only once a stage is set', () => {
    renderGroups(true);

    const buttonsOf = (name: string) => card(name).getAllByRole('button').map((button) => button.textContent);
    expect(buttonsOf('Acme Packaging')).toEqual(['Mark as sampling', 'Mark as in production']);
    expect(buttonsOf('Borealis Boxes')).toEqual(['Mark as sampling', 'Mark as in production', 'Clear stage']);
  });

  it('sets and clears a stage, and shows the message when the server refuses', async () => {
    const setManufacturerStage = vi.fn(async () => {
      throw new AppError('NOT_ALLOWED', 'You are not allowed to do that.');
    });
    renderGroups(true, { setManufacturerStage });

    fireEvent.click(card('Acme Packaging').getByRole('button', { name: 'Mark as sampling' }));
    expect(await card('Acme Packaging').findByRole('alert')).toHaveProperty('textContent', 'You are not allowed to do that.');
    fireEvent.click(card('Borealis Boxes').getByRole('button', { name: 'Clear stage' }));

    await waitFor(() =>
      expect(setManufacturerStage.mock.calls).toEqual([
        [SPEC, 'acme', 'sampling'],
        [SPEC, 'borealis', null],
      ]),
    );
  });
});
