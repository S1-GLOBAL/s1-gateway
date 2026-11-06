import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';
import type { QuoteProposalInput } from '../domain/sourcing/quote-suggestion.js';
import { ListManufacturers } from './list-manufacturers.js';
import {
  ApproveQuoteSuggestion,
  CountWaitingQuoteSuggestions,
  EditQuoteSuggestion,
  GetQuoteSuggestion,
  ListQuoteSuggestions,
  RejectQuoteSuggestion,
  WithdrawQuoteSuggestion,
} from './quote-suggestion-steps.js';
import { SaveSpecId } from './save-spec-id.js';
import { SuggestQuote } from './suggest-quote.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemoryQuoteSuggestionRepository } from './testing/in-memory-quote-suggestion-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const NOW = new Date('2026-11-06T08:00:00.000Z');

const VALUES = { fobPerUnit: '$0.0100', productionLeadTime: '30 days' };

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const sourcing = new InMemorySourcingRepository();
  const quotations = new InMemoryQuoteSuggestionRepository(specIds, sourcing);
  for (const person of [ADA, BEN]) {
    specIds.nameSaver(person.id, person.fullName);
    quotations.name(person.id, person.fullName);
  }
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  const saved = await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({
    name: 'Invented bagasse bowl',
    facts: { productType: PRODUCT_TYPE.bowl, material: MATERIAL.bagasse },
    savedBy: ADA,
  });
  if (!saved.ok) throw saved.error;
  // A manufacturer the verified list named, and its quote.
  await sourcing.replaceQuotes([
    {
      id: 'imported-quote',
      specId: saved.value.id,
      manufacturer: { id: 'maker-1', name: 'Invented Moulding Ltd', country: 'Nowhere' },
      values: { itemName: 'Bowl', fobPerUnit: '$0.0300', fobPerCase: null, fobTotal: null, moldCost: null, moldLeadTime: null, sampleLeadTime: null, productionLeadTime: null },
      importedAt: NOW,
    },
  ]);
  return {
    specId: saved.value.id,
    sourcing,
    suggest: new SuggestQuote(specIds, sourcing, quotations, clock, ids),
    edit: new EditQuoteSuggestion(sourcing, quotations, clock, ids),
    withdraw: new WithdrawQuoteSuggestion(quotations, clock, ids),
    approve: new ApproveQuoteSuggestion(quotations, clock, ids),
    reject: new RejectQuoteSuggestion(quotations, clock, ids),
    list: new ListQuoteSuggestions(quotations),
    get: new GetQuoteSuggestion(quotations),
    count: new CountWaitingQuoteSuggestions(quotations),
    manufacturers: new ListManufacturers(sourcing),
  };
}

type Context = Awaited<ReturnType<typeof setup>>;

async function added(context: Context, proposal: QuoteProposalInput = { manufacturer: { id: 'maker-1' }, values: VALUES }, by = ADA) {
  const result = await context.suggest.execute({ specId: context.specId, proposal, by });
  if (!result.ok) throw result.error;
  return result.value;
}

describe('Quotations added in Atlas (plan 0017, ADR 0035)', () => {
  it('waits, changing none of the Spec ID\'s quotes, and names its Spec ID, manufacturer and suggester', async () => {
    const context = await setup();
    const quotation = await added(context);

    expect(quotation).toMatchObject({
      specName: 'Invented bagasse bowl',
      manufacturer: { kind: 'existing', id: 'maker-1', name: 'Invented Moulding Ltd', country: 'Nowhere' },
      values: { fobPerUnit: '$0.0100', productionLeadTime: '30 days', fobPerCase: null },
      state: 'waiting',
      version: 1,
      suggestedBy: { id: ADA.id, fullName: 'Ada Invented' },
    });
    expect(context.sourcing.allQuotes.map((quote) => quote.id)).toEqual(['imported-quote']);
  });

  it('refuses a Spec ID or manufacturer that does not exist, and a quotation with no FOB per unit', async () => {
    const context = await setup();
    const refused = async (specId: string, proposal: QuoteProposalInput) => {
      const result = await context.suggest.execute({ specId, proposal, by: ADA });
      return result.ok ? null : result.error.issues;
    };
    expect(await refused('00000000-0000-4000-8000-000000000999', { manufacturer: { id: 'maker-1' }, values: VALUES })).toEqual({
      specId: ['No saved Spec ID has this id.'],
    });
    expect(await refused(context.specId, { manufacturer: { id: 'nobody' }, values: VALUES })).toEqual({
      manufacturer: ['No manufacturer has this id. Choose one from the list, or name a new one.'],
    });
    expect(await refused(context.specId, { manufacturer: { id: 'maker-1' }, values: {} })).toEqual({ fobPerUnit: ['Give the FOB price per unit.'] });
  });

  it('is edited by whoever added it, from the version they read, and by nobody else', async () => {
    const context = await setup();
    const quotation = await added(context);
    const changed = { manufacturer: { id: 'maker-1' }, values: { fobPerUnit: '$0.0120' } };

    expect(await context.edit.execute({ id: quotation.id, proposal: changed, version: 1, by: BEN })).toMatchObject({ ok: false, error: { code: 'NOT_ALLOWED' } });
    const edited = await context.edit.execute({ id: quotation.id, proposal: changed, version: 1, by: ADA });
    expect(edited.ok && [edited.value.version, edited.value.values.fobPerUnit]).toEqual([2, '$0.0120']);
    expect(await context.edit.execute({ id: quotation.id, proposal: changed, version: 1, by: ADA })).toMatchObject({
      ok: false,
      error: { code: 'QUOTE_SUGGESTION_CHANGED' },
    });
  });

  it('records the quote on the Spec ID when an admin who did not add it approves it, from the version read', async () => {
    const context = await setup();
    const quotation = await added(context);

    expect(await context.approve.execute({ id: quotation.id, version: 1, by: ADA })).toMatchObject({ ok: false, error: { code: 'NOT_ALLOWED' } });
    expect(await context.approve.execute({ id: quotation.id, version: 2, by: BEN })).toMatchObject({ ok: false, error: { code: 'QUOTE_SUGGESTION_CHANGED' } });
    const approved = await context.approve.execute({ id: quotation.id, version: 1, by: BEN });

    expect(approved.ok && approved.value).toMatchObject({ state: 'approved', decidedBy: { fullName: 'Ben Invented' } });
    const quote = context.sourcing.allQuotes.find((candidate) => candidate.suggestionId === quotation.id);
    expect(quote).toMatchObject({ specId: context.specId, manufacturerId: 'maker-1', values: { fobPerUnit: '$0.0100' }, importedAt: NOW });
    expect(approved.ok && approved.value.quoteId).toBe(quote?.id);
    expect(await context.approve.execute({ id: quotation.id, version: 1, by: BEN })).toMatchObject({ ok: false, error: { code: 'QUOTE_SUGGESTION_DECIDED' } });
  });

  it('adds a new manufacturer only once it is approved, or joins one of that name made meanwhile', async () => {
    const context = await setup();
    const fresh = await added(context, { manufacturer: { name: 'Invented Cups Co', country: 'Elsewhere' }, values: VALUES });
    const same = await added(context, { manufacturer: { name: ' invented moulding ltd ' }, values: VALUES });
    expect(context.sourcing.allManufacturers.map((manufacturer) => manufacturer.name)).toEqual(['Invented Moulding Ltd']);

    await context.approve.execute({ id: fresh.id, version: 1, by: BEN });
    await context.approve.execute({ id: same.id, version: 1, by: BEN });

    expect((await context.manufacturers.execute()).map(({ name, country }) => [name, country])).toEqual([
      ['Invented Cups Co', 'Elsewhere'],
      ['Invented Moulding Ltd', 'Nowhere'],
    ]);
    const joined = context.sourcing.allQuotes.find((quote) => quote.suggestionId === same.id);
    expect(joined?.manufacturerId).toBe('maker-1');
  });

  it('is rejected with a reason, and withdrawn only while it waits', async () => {
    const context = await setup();
    const rejected = await added(context);
    expect(await context.reject.execute({ id: rejected.id, reason: ' ', by: BEN })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    const decided = await context.reject.execute({ id: rejected.id, reason: 'That price is per thousand.', by: BEN });
    expect(decided.ok && [decided.value.state, decided.value.reason]).toEqual(['rejected', 'That price is per thousand.']);
    expect(await context.withdraw.execute({ id: rejected.id, by: ADA })).toMatchObject({ ok: false, error: { code: 'QUOTE_SUGGESTION_DECIDED' } });

    const withdrawn = await context.withdraw.execute({ id: (await added(context)).id, by: ADA });
    expect(withdrawn.ok && withdrawn.value.state).toBe('withdrawn');
    expect(context.sourcing.allQuotes.map((quote) => quote.id)).toEqual(['imported-quote']);
  });

  it('lists those waiting, all or one Spec ID\'s, counts those another added, and tells each one\'s trail', async () => {
    const context = await setup();
    const quotation = await added(context);
    await added(context, { manufacturer: { id: 'maker-1' }, values: VALUES }, BEN);
    await context.edit.execute({ id: quotation.id, proposal: { manufacturer: { id: 'maker-1' }, values: { fobPerUnit: '$0.0110' } }, version: 1, by: ADA });

    expect(await context.list.execute({ state: 'waiting', specId: context.specId })).toHaveLength(2);
    expect(await context.list.execute({ state: 'waiting', specId: '00000000-0000-4000-8000-000000000999' })).toEqual([]);
    expect(await context.count.execute({ by: ADA })).toBe(1);
    const detail = await context.get.execute({ id: quotation.id });
    expect(detail.ok && detail.value.trail.map((step) => [step.kind, step.by.fullName])).toEqual([
      ['suggested', 'Ada Invented'],
      ['edited', 'Ada Invented'],
    ]);
  });

  it('keeps a quote approved in Atlas when the import replaces its own', async () => {
    const context = await setup();
    const quotation = await added(context);
    await context.approve.execute({ id: quotation.id, version: 1, by: BEN });

    await context.sourcing.replaceQuotes([]);

    expect(context.sourcing.allQuotes.map((quote) => quote.suggestionId)).toEqual([quotation.id]);
  });
});
