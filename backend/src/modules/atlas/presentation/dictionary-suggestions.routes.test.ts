import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FixedClock, RecordingLogger, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { ApproveDictionarySuggestion } from '../application/approve-dictionary-suggestion.js';
import { CountWaitingSuggestions } from '../application/count-waiting-suggestions.js';
import { EditDictionarySuggestion } from '../application/edit-dictionary-suggestion.js';
import { GetDictionarySuggestion } from '../application/get-dictionary-suggestion.js';
import { GetDictionaryUsage } from '../application/get-dictionary-usage.js';
import { ListDictionarySuggestions } from '../application/list-dictionary-suggestions.js';
import { RejectDictionarySuggestion } from '../application/reject-dictionary-suggestion.js';
import { SuggestDictionaryChange } from '../application/suggest-dictionary-change.js';
import { InMemoryDictionaryChangeStore } from '../application/testing/in-memory-dictionary-change-store.js';
import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from '../application/testing/in-memory-spec-id-repository.js';
import { InMemorySuggestionRepository } from '../application/testing/in-memory-suggestion-repository.js';
import { WithdrawDictionarySuggestion } from '../application/withdraw-dictionary-suggestion.js';
import { DictionarySuggestionsController } from './dictionary-suggestions.controller.js';
import { createDictionarySuggestionsAdminRouter, createDictionarySuggestionsRouter } from './dictionary-suggestions.routes.js';

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
      get: new GetDictionarySuggestion(dictionaries, suggestions, specIds),
      countWaiting: new CountWaitingSuggestions(suggestions),
      usage: new GetDictionaryUsage(specIds),
      approve: new ApproveDictionarySuggestion(
        dictionaries,
        specIds,
        suggestions,
        new InMemoryDictionaryChangeStore(dictionaries, specIds, suggestions),
        clock,
        ids,
      ),
      reject: new RejectDictionarySuggestion(suggestions, clock, ids),
    },
    // Route shape only: production asks the session; here a header picks who asks.
    (req) => (req.header('x-asker') === 'ben' ? BEN : ADA),
  );
  return createApp({
    // Route shape only: production puts approve and reject behind the admin gate.
    modules: [
      { path: '/atlas/dictionary', router: createDictionarySuggestionsRouter(controller), access: 'public' },
      { path: '/atlas/dictionary', router: createDictionarySuggestionsAdminRouter(controller), access: 'public' },
    ],
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

describe('approving and rejecting', () => {
  async function suggested(app: ReturnType<typeof setup>) {
    return (await request(app).post(`${BASE}/suggestions`).send(NEW_MATERIAL)).body.data as { id: string };
  }

  it('approves as change #1, and the dictionary has the option on the next request', async () => {
    const app = setup();
    const { id } = await suggested(app);

    const approved = await request(app).post(`${BASE}/suggestions/${id}/approve`).set('x-asker', 'ben').send({ version: 1 });

    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({
      changeNumber: 1,
      specIdsRewritten: 0,
      suggestion: { state: 'approved', decidedBy: { fullName: 'Ben Invented' }, changeNumber: 1 },
    });
    const detail = await request(app).get(`${BASE}/suggestions/${id}`);
    expect(detail.body.data.events.map((event: { kind: string }) => event.kind)).toEqual(['suggested', 'approved']);
    expect(detail.body.data).toMatchObject({ rewrites: null, problem: null });
  });

  it("answers 403 NOT_ALLOWED to the suggester's own approval or rejection, in #95's words", async () => {
    const app = setup();
    const { id } = await suggested(app);
    for (const [action, body] of [['approve', { version: 1 }], ['reject', { reason: 'No.' }]] as const) {
      const refused = await request(app).post(`${BASE}/suggestions/${id}/${action}`).send(body);
      expect(refused.status).toBe(403);
      expect(refused.body.error).toEqual({ code: 'NOT_ALLOWED', message: "You can't approve or reject your own suggestion." });
    }
  });

  it('answers 409 SUGGESTION_CHANGED to an approval of an older version, and 409 SUGGESTION_DECIDED once decided', async () => {
    const app = setup();
    const { id } = await suggested(app);
    await request(app)
      .put(`${BASE}/suggestions/${id}`)
      .send({ ...NEW_MATERIAL, proposal: { ...NEW_MATERIAL.proposal, meaning: 'Polymer, renamed' }, version: 1 });

    const stale = await request(app).post(`${BASE}/suggestions/${id}/approve`).set('x-asker', 'ben').send({ version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('SUGGESTION_CHANGED');

    await request(app).post(`${BASE}/suggestions/${id}/approve`).set('x-asker', 'ben').send({ version: 2 });
    const again = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({ reason: 'Late.' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SUGGESTION_DECIDED');
  });

  it('rejects with a reason, and answers 400 under reason without one, naming the suggester', async () => {
    const app = setup();
    const { id } = await suggested(app);

    const blank = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({ reason: '  ' });
    expect(blank.status).toBe(400);
    expect(blank.body.error.details.fields.reason).toEqual(['Say why, so Ada Invented knows what to change.']);

    const rejected = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({ reason: ' Already APP. ' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({ state: 'rejected', reason: 'Already APP.', decidedBy: { fullName: 'Ben Invented' } });
  });

  it('answers 400 under reason to a reason of 501 characters, and rejects with one of 500', async () => {
    const app = setup();
    const { id } = await suggested(app);

    const long = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({ reason: 'a'.repeat(501) });
    expect(long.status).toBe(400);
    expect(long.body.error.details.fields.reason).toEqual(['Keep it to 500 characters.']);

    const longest = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({ reason: 'a'.repeat(500) });
    expect(longest.status).toBe(200);
  });

  it("answers a rejection with no reason at all in #95's words", async () => {
    const app = setup();
    const { id } = await suggested(app);

    const missing = await request(app).post(`${BASE}/suggestions/${id}/reject`).set('x-asker', 'ben').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fields.reason).toEqual(['Say why, so Ada Invented knows what to change.']);
  });

  it('answers 409 SUGGESTION_OUT_OF_DATE when another approval took its code first', async () => {
    const app = setup();
    const first = await suggested(app);
    const second = await suggested(app);
    await request(app).post(`${BASE}/suggestions/${first.id}/approve`).set('x-asker', 'ben').send({ version: 1 });

    const late = await request(app).post(`${BASE}/suggestions/${second.id}/approve`).set('x-asker', 'ben').send({ version: 1 });
    expect(late.status).toBe(409);
    expect(late.body.error).toMatchObject({
      code: 'SUGGESTION_OUT_OF_DATE',
      message:
        'The dictionary changed since this was suggested: AZZ is already Polymer, invented. The suggester can edit it, or you can reject it.',
    });
    expect((await request(app).get(`${BASE}/suggestions/${second.id}`)).body.data.problem).toBe(late.body.error.message);
  });
});
