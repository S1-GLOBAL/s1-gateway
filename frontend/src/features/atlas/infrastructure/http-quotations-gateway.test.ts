import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { HttpQuotationsGateway } from './http-quotations-gateway';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

interface Sent {
  method: string | undefined;
  url: string | undefined;
  body: unknown;
  params?: unknown;
}

function gatewayAnswering(status: number, data: unknown, sent: Sent[] = []): HttpQuotationsGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data === undefined ? undefined : JSON.parse(config.data as string),
      params: config.params,
    });
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  return new HttpQuotationsGateway(axios.create({ adapter }));
}

const VALUES = {
  itemName: null,
  fobPerUnit: '$0.0100',
  fobPerCase: null,
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: null,
  productionLeadTime: '30 days',
};

const wire = {
  id: 'q1',
  specId: 's1',
  specName: 'Invented PP cup',
  specCode: 'A5B3',
  manufacturer: { kind: 'new', name: 'Invented Cups Co', country: 'Elsewhere' },
  values: VALUES,
  state: 'waiting',
  version: 1,
  suggestedBy: { id: 'ada', fullName: 'Ada Invented' },
  suggestedAt: '2026-11-06T08:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  reason: null,
  quoteId: null,
};

describe('HttpQuotationsGateway (plan 0017)', () => {
  it('adds a quotation to a Spec ID, and reads it back with its dates as dates', async () => {
    const sent: Sent[] = [];
    const fields = { manufacturer: { name: 'Invented Cups Co', country: 'Elsewhere' }, values: { fobPerUnit: '$0.0100' } };

    const quotation = await gatewayAnswering(201, { data: wire }, sent).add('s1', fields);

    expect(sent).toEqual([{ method: 'post', url: '/atlas/quote-suggestions', body: { specId: 's1', ...fields }, params: undefined }]);
    expect(quotation).toMatchObject({ id: 'q1', manufacturer: { kind: 'new', name: 'Invented Cups Co' }, suggestedAt: new Date('2026-11-06T08:00:00.000Z'), decidedAt: null });
  });

  it('edits from the version read, and lists one Spec ID\'s or all', async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: wire }, sent).edit('q1', { manufacturer: { id: 'acme' }, values: {} }, 3);
    await gatewayAnswering(200, { data: [wire] }, sent).list('waiting', 's1');
    await gatewayAnswering(200, { data: [] }, sent).list('decided');

    expect(sent.map(({ method, url, body, params }) => [method, url, body, params])).toEqual([
      ['put', '/atlas/quote-suggestions/q1', { version: 3, manufacturer: { id: 'acme' }, values: {} }, undefined],
      ['get', '/atlas/quote-suggestions', undefined, { state: 'waiting', specId: 's1' }],
      ['get', '/atlas/quote-suggestions', undefined, { state: 'decided' }],
    ]);
  });

  it('approves, rejects and withdraws; reads the trail, the count and the manufacturers', async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: wire }, sent).approve('q1', 2);
    await gatewayAnswering(200, { data: wire }, sent).reject('q1', 'Per thousand.');
    await gatewayAnswering(200, { data: wire }, sent).withdraw('q1');
    const trail = { ...wire, trail: [{ kind: 'suggested', by: { id: 'ada', fullName: 'Ada Invented' }, at: '2026-11-06T08:00:00.000Z', proposalBefore: null, proposalAfter: null, reason: null }] };
    const detail = await gatewayAnswering(200, { data: trail }, sent).get('q1');
    const count = await gatewayAnswering(200, { data: { count: 2 } }, sent).waitingCount();
    const makers = await gatewayAnswering(200, { data: [{ id: 'acme', name: 'Acme Packaging', country: null }] }, sent).manufacturers();

    expect(sent.map(({ method, url, body }) => [method, url, body])).toEqual([
      ['post', '/atlas/quote-suggestions/q1/approve', { version: 2 }],
      ['post', '/atlas/quote-suggestions/q1/reject', { reason: 'Per thousand.' }],
      ['post', '/atlas/quote-suggestions/q1/withdraw', undefined],
      ['get', '/atlas/quote-suggestions/q1', undefined],
      ['get', '/atlas/quote-suggestions/waiting-count', undefined],
      ['get', '/atlas/manufacturers', undefined],
    ]);
    expect(detail.trail).toEqual([{ kind: 'suggested', by: { id: 'ada', fullName: 'Ada Invented' }, at: new Date('2026-11-06T08:00:00.000Z'), reason: null }]);
    expect([count, makers]).toEqual([2, [{ id: 'acme', name: 'Acme Packaging', country: null }]]);
  });

  it('rejects with an AppError carrying each field\'s message', async () => {
    const answer = { error: { code: 'VALIDATION_FAILED', message: 'The quotation is not valid.', details: { fields: { fobPerUnit: ['Give the FOB price per unit.'] } } } };
    const failure = await gatewayAnswering(400, answer).add('s1', { manufacturer: { id: 'acme' }, values: {} }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).fields.fobPerUnit).toEqual(['Give the FOB price per unit.']);
  });
});
