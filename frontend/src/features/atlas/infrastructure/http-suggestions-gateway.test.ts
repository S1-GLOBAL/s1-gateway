import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { HttpSuggestionsGateway } from './http-suggestions-gateway';

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

const wireSuggestion = {
  id: 's1',
  kind: 'edit',
  slot: 'material',
  code: 'APS',
  proposal: { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null },
  state: 'waiting',
  version: 2,
  suggestedBy: ADA,
  suggestedAt: '2026-10-27T08:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  reason: null,
  changeNumber: null,
};

interface Sent {
  method: string | undefined;
  url: string | undefined;
  body: unknown;
  params?: unknown;
}

function gatewayAnswering(status: number, data: unknown, sent: Sent[] = []): HttpSuggestionsGateway {
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
  return new HttpSuggestionsGateway(axios.create({ adapter }));
}

describe('HttpSuggestionsGateway', () => {
  it('asks for one list by state, and reads its dates', async () => {
    const sent: Sent[] = [];
    const [suggestion] = await gatewayAnswering(200, { data: [wireSuggestion] }, sent).list('decided');

    expect(sent[0]).toMatchObject({ method: 'get', url: '/atlas/dictionary/suggestions', params: { state: 'decided' } });
    expect(suggestion).toMatchObject({ id: 's1', code: 'APS', version: 2, suggestedBy: ADA, decidedAt: null });
    expect(suggestion?.suggestedAt).toEqual(new Date('2026-10-27T08:00:00.000Z'));
  });

  it('reads one suggestion with its trail, its use, and what approving would rewrite', async () => {
    const detail = await gatewayAnswering(200, {
      data: {
        ...wireSuggestion,
        events: [{ kind: 'suggested', by: ADA, at: '2026-10-27T08:00:00.000Z', proposalBefore: null, proposalAfter: wireSuggestion.proposal, reason: null }],
        usage: 1,
        rewrites: [{ id: 'x1', name: 'Lid 90', codeBefore: 'BLD.APS.Y', codeAfter: 'BLD.APZ.Y' }],
        problem: null,
      },
    }).get('s1');

    expect(detail.events).toEqual([
      { kind: 'suggested', by: ADA, at: new Date('2026-10-27T08:00:00.000Z'), proposalBefore: null, proposalAfter: wireSuggestion.proposal, reason: null },
    ]);
    expect(detail).toMatchObject({ usage: 1, rewrites: [{ codeAfter: 'BLD.APZ.Y' }], problem: null });
  });

  it('reads a detail from an API that sends no rewrites or problem as neither', async () => {
    const detail = await gatewayAnswering(200, { data: { ...wireSuggestion, events: [], usage: 0 } }).get('s1');
    expect(detail).toMatchObject({ rewrites: null, problem: null });
  });

  it('answers the waiting count', async () => {
    const sent: Sent[] = [];
    expect(await gatewayAnswering(200, { data: { count: 3 } }, sent).waitingCount()).toBe(3);
    expect(sent[0]?.url).toBe('/atlas/dictionary/suggestions/waiting-count');
  });

  it('approves from the version read, and answers the numbered change', async () => {
    const sent: Sent[] = [];
    const approved = await gatewayAnswering(
      200,
      { data: { suggestion: { ...wireSuggestion, state: 'approved', decidedBy: BEN, changeNumber: 4 }, changeNumber: 4, specIdsRewritten: 3 } },
      sent,
    ).approve('s1', 2);

    expect(sent[0]).toMatchObject({ method: 'post', url: '/atlas/dictionary/suggestions/s1/approve', body: { version: 2 } });
    expect(approved).toMatchObject({ changeNumber: 4, specIdsRewritten: 3, suggestion: { state: 'approved', decidedBy: BEN } });
  });

  it("rejects with a reason, and keeps a refusal's words under reason", async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: { ...wireSuggestion, state: 'rejected', reason: 'We have APP.' } }, sent).reject('s1', 'We have APP.');
    expect(sent[0]).toMatchObject({ url: '/atlas/dictionary/suggestions/s1/reject', body: { reason: 'We have APP.' } });

    const refused = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The suggestion is not valid.', details: { fields: { reason: ['Say why, so Ada Invented knows what to change.'] } } },
    }).reject('s1', '');
    await expect(refused).rejects.toMatchObject({ fields: { reason: ['Say why, so Ada Invented knows what to change.'] } });
  });

  it("withdraws with no body, and passes a refused approval's own message on", async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: { ...wireSuggestion, state: 'withdrawn' } }, sent).withdraw('s1');
    expect(sent[0]).toMatchObject({ method: 'post', url: '/atlas/dictionary/suggestions/s1/withdraw', body: undefined });

    const message = 'Approving this would make saved Spec IDs identical: A and B. Edit or reject the suggestion.';
    await expect(gatewayAnswering(409, { error: { code: 'SPEC_IDS_WOULD_CLASH', message } }).approve('s1', 1)).rejects.toMatchObject({
      code: 'SPEC_IDS_WOULD_CLASH',
      message,
    });
  });
});
