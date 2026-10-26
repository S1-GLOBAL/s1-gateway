import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FixedClock, RecordingLogger, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { CountWaitingSuggestions } from '../application/count-waiting-suggestions.js';
import { EditDictionarySuggestion } from '../application/edit-dictionary-suggestion.js';
import { GetDictionarySuggestion } from '../application/get-dictionary-suggestion.js';
import { GetDictionaryUsage } from '../application/get-dictionary-usage.js';
import { ListDictionarySuggestions } from '../application/list-dictionary-suggestions.js';
import { SuggestDictionaryChange } from '../application/suggest-dictionary-change.js';
import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from '../application/testing/in-memory-spec-id-repository.js';
import { InMemorySuggestionRepository } from '../application/testing/in-memory-suggestion-repository.js';
import { WithdrawDictionarySuggestion } from '../application/withdraw-dictionary-suggestion.js';
import { DictionarySuggestionsController } from './dictionary-suggestions.controller.js';
import { createDictionarySuggestionsRouter } from './dictionary-suggestions.routes.js';

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const BASE = '/api/v1/atlas/dictionary';
const NEW_MATERIAL = {
  slot: 'material',
  code: 'azz',
  proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null },
};

function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const suggestions = new InMemorySuggestionRepository();
  for (const person of [ADA, BEN]) suggestions.nameAccount(person.id, person.fullName);
  const clock = new FixedClock(new Date('2026-10-27T08:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  const controller = new DictionarySuggestionsController(
    {
      suggest: new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids),
      edit: new EditDictionarySuggestion(dictionaries, specIds, suggestions, clock, ids),
      withdraw: new WithdrawDictionarySuggestion(suggestions, clock, ids),
      list: new ListDictionarySuggestions(suggestions),
      get: new GetDictionarySuggestion(suggestions, specIds),
      countWaiting: new CountWaitingSuggestions(suggestions),
      usage: new GetDictionaryUsage(specIds),
    },
    // Route shape only: production asks the session; here a header picks who asks.
    (req) => (req.header('x-asker') === 'ben' ? BEN : ADA),
  );
  return createApp({
    modules: [{ path: '/atlas/dictionary', router: createDictionarySuggestionsRouter(controller), access: 'public' }],
    logger: new RecordingLogger(),
    corsOrigin: 'http://localhost:5173',
  });
}

describe('POST /api/v1/atlas/dictionary/suggestions', () => {
  it('answers 201 with the waiting suggestion, its code in capitals', async () => {
    const response = await request(setup()).post(`${BASE}/suggestions`).send(NEW_MATERIAL);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      kind: 'add',
      slot: 'material',
      code: 'AZZ',
      state: 'waiting',
      version: 1,
      suggestedBy: { fullName: 'Ada Invented' },
    });
  });

  it("answers 400 VALIDATION_FAILED with the domain's message under its field", async () => {
    const response = await request(setup())
      .post(`${BASE}/suggestions`)
      .send({ ...NEW_MATERIAL, code: 'APS' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.code).toEqual(['APS is already Polymer, PS (polystyrene).']);
  });

  it('answers 400 for a list that is not in the dictionary, or a proposal of no known kind', async () => {
    const app = setup();
    expect((await request(app).post(`${BASE}/suggestions`).send({ ...NEW_MATERIAL, slot: 'height' })).status).toBe(400);
    expect(
      (await request(app).post(`${BASE}/suggestions`).send({ ...NEW_MATERIAL, proposal: { kind: 'merge' } })).status,
    ).toBe(400);
  });
});

describe('the suggestion routes', () => {
  async function suggested(app: ReturnType<typeof setup>) {
    return (await request(app).post(`${BASE}/suggestions`).send(NEW_MATERIAL)).body.data as { id: string };
  }

  it('lists it as waiting, and reads it with its trail and its use', async () => {
    const app = setup();
    const { id } = await suggested(app);

    const waiting = await request(app).get(`${BASE}/suggestions`);
    expect(waiting.body.data.map((s: { id: string }) => s.id)).toEqual([id]);
    expect((await request(app).get(`${BASE}/suggestions?state=decided`)).body.data).toEqual([]);

    const detail = await request(app).get(`${BASE}/suggestions/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.usage).toBe(0);
    expect(detail.body.data.events).toEqual([
      expect.objectContaining({ kind: 'suggested', by: { id: ADA.id, fullName: 'Ada Invented' } }),
    ]);
  });

  it('lets the suggester edit from the version they read, and answers 409 SUGGESTION_CHANGED from an old one', async () => {
    const app = setup();
    const { id } = await suggested(app);
    const edit = { ...NEW_MATERIAL, proposal: { ...NEW_MATERIAL.proposal, meaning: 'Polymer, renamed' }, version: 1 };

    const edited = await request(app).put(`${BASE}/suggestions/${id}`).send(edit);
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ version: 2, proposal: { meaning: 'Polymer, renamed' } });

    const stale = await request(app).put(`${BASE}/suggestions/${id}`).send(edit);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('SUGGESTION_CHANGED');
  });

  it("answers 403 NOT_ALLOWED to anyone else's edit or withdrawal", async () => {
    const app = setup();
    const { id } = await suggested(app);
    const edit = await request(app).put(`${BASE}/suggestions/${id}`).set('x-asker', 'ben').send({ ...NEW_MATERIAL, version: 1 });
    expect(edit.status).toBe(403);
    expect(edit.body.error).toMatchObject({ code: 'NOT_ALLOWED', message: 'Only the person who suggested this can change it.' });
    expect((await request(app).post(`${BASE}/suggestions/${id}/withdraw`).set('x-asker', 'ben')).status).toBe(403);
  });

  it('withdraws it, then answers 409 SUGGESTION_DECIDED', async () => {
    const app = setup();
    const { id } = await suggested(app);
    const withdrawn = await request(app).post(`${BASE}/suggestions/${id}/withdraw`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.state).toBe('withdrawn');
    const again = await request(app).post(`${BASE}/suggestions/${id}/withdraw`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SUGGESTION_DECIDED');
  });

  it('answers 404 SUGGESTION_NOT_FOUND for an unknown id and for anything that is not an id', async () => {
    const app = setup();
    for (const id of ['00000000-0000-4000-8000-0000000000ff', 'not-an-id']) {
      const response = await request(app).get(`${BASE}/suggestions/${id}`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SUGGESTION_NOT_FOUND');
    }
  });

  it('counts waiting suggestions for an admin, not their own, and none for staff', async () => {
    const app = setup();
    await suggested(app);
    expect((await request(app).get(`${BASE}/suggestions/waiting-count`).set('x-asker', 'ben')).body.data).toEqual({ count: 1 });
    expect((await request(app).get(`${BASE}/suggestions/waiting-count`)).body.data).toEqual({ count: 0 });
  });
});

describe('GET /api/v1/atlas/dictionary/usage/:slot/:code', () => {
  it('counts saved Spec IDs holding an option, and refuses a list that is not in the dictionary', async () => {
    const app = setup();
    expect((await request(app).get(`${BASE}/usage/material/APS`)).body.data).toEqual({ count: 0 });
    const refused = await request(app).get(`${BASE}/usage/height/AB`);
    expect(refused.status).toBe(400);
    expect(refused.body.error.details.fields.slot).toEqual(['That is not a dictionary list.']);
  });
});
