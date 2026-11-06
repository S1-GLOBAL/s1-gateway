import type { ManufacturerQuote } from '../../domain/atlas';
import type { Quotation } from '../../domain/quotation';
import type { QuotationsGateway } from '../quotations-gateway';

/*
 * Quotations for tests (plan 0017). Every name, price and lead time is
 * invented: never Source One's (constraints §6).
 */

export const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
export const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

const NO_VALUES: ManufacturerQuote = {
  itemName: null,
  fobPerUnit: null,
  fobPerCase: null,
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: null,
  productionLeadTime: null,
};

/** A quotation Ada added, waiting, from a manufacturer already in Atlas, unless the test says otherwise. */
export function quotationFor(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    specId: '00000000-0000-4000-8000-000000000001',
    specName: 'Invented PP cup',
    specCode: 'A5B3',
    manufacturer: { kind: 'existing', id: 'acme', name: 'Acme Packaging', country: 'Atlantis' },
    values: { ...NO_VALUES, fobPerUnit: '$0.0100', productionLeadTime: '30 days' },
    state: 'waiting',
    version: 1,
    suggestedBy: ADA,
    suggestedAt: new Date('2026-11-06T08:00:00.000Z'),
    decidedBy: null,
    decidedAt: null,
    reason: null,
    ...overrides,
  };
}

/** A gateway with no quotation and no manufacturer, whose writes wait forever, but for the calls given. */
export function quotationsGatewayWith(overrides: Partial<QuotationsGateway> = {}): QuotationsGateway {
  const pending = () => new Promise<never>(() => undefined);
  return {
    manufacturers: async () => [],
    add: pending,
    edit: pending,
    list: async () => [],
    get: pending,
    waitingCount: async () => 0,
    approve: pending,
    reject: pending,
    withdraw: pending,
    ...overrides,
  };
}
