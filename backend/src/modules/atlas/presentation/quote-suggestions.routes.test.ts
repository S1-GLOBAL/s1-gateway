import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FixedClock, RecordingLogger, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { ListManufacturers } from '../application/list-manufacturers.js';
import {
  ApproveQuoteSuggestion,
  CountWaitingQuoteSuggestions,
  EditQuoteSuggestion,
  GetQuoteSuggestion,
  ListQuoteSuggestions,
  RejectQuoteSuggestion,
  WithdrawQuoteSuggestion,
} from '../application/quote-suggestion-steps.js';
import { SaveSpecId } from '../application/save-spec-id.js';
import { SuggestQuote } from '../application/suggest-quote.js';
import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
import { InMemoryQuoteSuggestionRepository } from '../application/testing/in-memory-quote-suggestion-repository.js';
import { InMemorySourcingRepository } from '../application/testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from '../application/testing/in-memory-spec-id-repository.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';
import { QuoteSuggestionsController } from './quote-suggestions.controller.js';
import { createQuoteSuggestionsAdminRouter, createQuoteSuggestionsRouter } from './quote-suggestions.routes.js';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const BASE = '/api/v1/atlas';

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const sourcing = new InMemorySourcingRepository();
  const quotations = new InMemoryQuoteSuggestionRepository(specIds, sourcing);
  for (const person of [ADA, BEN]) {
    specIds.nameSaver(person.id, person.fullName);
    quotations.name(person.id, person.fullName);
  }
  const clock = new FixedClock(new Date('2026-11-06T08:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  const saved = await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({
    name: 'Invented bagasse bowl',
    facts: { productType: PRODUCT_TYPE.bowl, material: MATERIAL.bagasse },
    savedBy: ADA,
  });
  if (!saved.ok) throw saved.error;
  const controller = new QuoteSuggestionsController(
    {
      suggest: new SuggestQuote(specIds, sourcing, quotations, clock, ids),
      edit: new EditQuoteSuggestion(sourcing, quotations, clock, ids),
      withdraw: new WithdrawQuoteSuggestion(quotations, clock, ids),
      list: new ListQuoteSuggestions(quotations),
      get: new GetQuoteSuggestion(quotations),
      countWaiting: new CountWaitingQuoteSuggestions(quotations),
      approve: new ApproveQuoteSuggestion(quotations, clock, ids),
      reject: new RejectQuoteSuggestion(quotations, clock, ids),
      manufacturers: new ListManufacturers(sourcing),
    },
    // Route shape only: production asks the session; here a header picks who asks.
    (req) => (req.header('x-asker') === 'ben' ? BEN : ADA),
  );
  const app = createApp({
    // Route shape only: production puts approve and reject behind the admin gate.
    modules: [
      { path: '/atlas', router: createQuoteSuggestionsRouter(controller), access: 'public' },
      { path: '/atlas', router: createQuoteSuggestionsAdminRouter(controller), access: 'public' },
    ],
    logger: new RecordingLogger(),
    corsOrigin: 'http://localhost:5173',
  });
  return { app, specId: saved.value.id, sourcing };
}

const NEW_MAKER = { name: 'Invented Cups Co', country: 'Elsewhere' };

describe('Quotation routes (plan 0017)', () => {
  it('adds a waiting quotation, 201, and lists it for its Spec ID', async () => {
    const { app, specId } = await setup();
    const added = await request(app).post(`${BASE}/quote-suggestions`).send({ specId, manufacturer: NEW_MAKER, values: { fobPerUnit: '$0.0100' } });

    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ state: 'waiting', manufacturer: { kind: 'new', name: 'Invented Cups Co' }, values: { fobPerUnit: '$0.0100' } });
    const listed = await request(app).get(`${BASE}/quote-suggestions`).query({ state: 'waiting', specId });
    expect(listed.body.data.map((quotation: { id: string }) => quotation.id)).toEqual([added.body.data.id]);
    expect((await request(app).get(`${BASE}/quote-suggestions/waiting-count`).set('x-asker', 'ben')).body.data).toEqual({ count: 1 });
  });

  it('answers 400 naming each field a quotation lacks, and for a body of the wrong shape', async () => {
    const { app, specId } = await setup();
    const missing = await request(app).post(`${BASE}/quote-suggestions`).send({ specId, manufacturer: {}, values: {} });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fields).toEqual({
      manufacturer: ['Choose a manufacturer, or name a new one.'],
      fobPerUnit: ['Give the FOB price per unit.'],
    });
    expect((await request(app).post(`${BASE}/quote-suggestions`).send({ specId: 'not-an-id' })).status).toBe(400);
  });

  it('approves from the version read, 200, adding the manufacturer and the quote; 403 for whoever added it', async () => {
    const { app, specId, sourcing } = await setup();
    const { body } = await request(app).post(`${BASE}/quote-suggestions`).send({ specId, manufacturer: NEW_MAKER, values: { fobPerUnit: '$0.0100' } });
    const id: string = body.data.id;

    expect((await request(app).post(`${BASE}/quote-suggestions/${id}/approve`).send({ version: 1 })).status).toBe(403);
    expect((await request(app).post(`${BASE}/quote-suggestions/${id}/approve`).set('x-asker', 'ben').send({ version: 2 })).status).toBe(409);
    const approved = await request(app).post(`${BASE}/quote-suggestions/${id}/approve`).set('x-asker', 'ben').send({ version: 1 });

    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ state: 'approved', decidedBy: { fullName: 'Ben Invented' } });
    expect((await request(app).get(`${BASE}/manufacturers`)).body.data).toEqual([
      { id: expect.any(String), name: 'Invented Cups Co', country: 'Elsewhere' },
    ]);
    expect(sourcing.allQuotes.map((quote) => quote.suggestionId)).toEqual([id]);
  });

  it('edits, withdraws, rejects and reads a quotation with its trail', async () => {
    const { app, specId } = await setup();
    const add = () => request(app).post(`${BASE}/quote-suggestions`).send({ specId, manufacturer: NEW_MAKER, values: { fobPerUnit: '$0.0100' } });
    const first: string = (await add()).body.data.id;
    const second: string = (await add()).body.data.id;

    const edited = await request(app).put(`${BASE}/quote-suggestions/${first}`).send({ version: 1, manufacturer: NEW_MAKER, values: { fobPerUnit: '$0.0120' } });
    expect([edited.status, edited.body.data.version]).toEqual([200, 2]);
    expect((await request(app).post(`${BASE}/quote-suggestions/${first}/withdraw`)).body.data.state).toBe('withdrawn');
    const rejected = await request(app).post(`${BASE}/quote-suggestions/${second}/reject`).set('x-asker', 'ben').send({ reason: 'Per thousand.' });
    expect([rejected.status, rejected.body.data.reason]).toEqual([200, 'Per thousand.']);

    const detail = await request(app).get(`${BASE}/quote-suggestions/${first}`);
    expect(detail.body.data.trail.map((step: { kind: string }) => step.kind)).toEqual(['suggested', 'edited', 'withdrawn']);
    expect((await request(app).get(`${BASE}/quote-suggestions`).query({ state: 'decided' })).body.data).toHaveLength(2);
  });

  it('answers 404 for an id that names no quotation', async () => {
    const { app } = await setup();
    expect((await request(app).get(`${BASE}/quote-suggestions/not-an-id`)).status).toBe(404);
    expect((await request(app).get(`${BASE}/quote-suggestions/00000000-0000-4000-8000-000000000999`)).body.error.code).toBe('QUOTE_SUGGESTION_NOT_FOUND');
  });
});
