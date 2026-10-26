import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ManufacturerQuote, SpecIdManufacturer } from '../../domain/atlas';
import { ManufacturerGroups } from './ManufacturerGroups';

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

function renderGroups() {
  render(<ManufacturerGroups manufacturers={[acme, borealis]} timeZone="UTC" />);
}

const card = (name: string) => within(screen.getByRole('article', { name }));

describe('ManufacturerGroups', () => {
  it("shows each manufacturer once in its group, with its country, stage and every quote under #57's labels", () => {
    renderGroups();

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
    renderGroups();

    expect(card('Borealis Boxes').getByText('Set to Sampling by Ada Admin on 23 October 2026')).toBeTruthy();
    expect(card('Acme Packaging').queryByText(/^Set to/)).toBeNull();
  });

  it('shows no button that changes a manufacturer stage', () => {
    renderGroups();

    expect(screen.queryByRole('button', { name: 'Mark as sampling' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as in production' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear stage' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
