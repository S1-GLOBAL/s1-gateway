import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { QuoteSuggestion, type QuoteProposal } from '../domain/sourcing/quote-suggestion.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import { SpecId } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { DrizzleQuoteSuggestionRepository } from './drizzle-quote-suggestion-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

const connection = connectTestDatabase();
const repository = new DrizzleQuoteSuggestionRepository(connection.db);
const sourcing = new DrizzleSourcingRepository(connection.db);

const ADA = '00000000-0000-4000-8000-0000000000aa';
const BEN = '00000000-0000-4000-8000-0000000000bb';
const CUP_ID = '00000000-0000-4000-8000-00000000c001';
const AT = new Date('2026-11-06T08:00:00.000Z');

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

function suggested(proposal: QuoteProposal, by = ADA) {
  return QuoteSuggestion.suggest({ id: randomUUID(), eventId: randomUUID(), specId: CUP_ID, proposal, by, at: AT });
}

beforeEach(async () => {
  await resetTables(connection.db);
  await connection.db.insert(accountsTable).values(
    [
      [ADA, 'ada@sourceone.global', 'Ada Invented'],
      [BEN, 'ben@sourceone.global', 'Ben Invented'],
    ].map(([id, email, fullName]) => ({ id: id as string, email: email as string, fullName: fullName as string, passwordHash: 'hash', status: 'approved', createdAt: AT })),
  );
  const built = SpecId.build({ productType: PRODUCT_TYPE.cup, material: MATERIAL.pp }, s2Dictionary());
  if (!built.ok) throw new Error('setup failed');
  const cup = SavedSpecId.restore({ id: CUP_ID, specId: built.value, name: 'Invented PP cup', dictionaryRelease: 'S2 0.1.0', savedBy: ADA, savedAt: AT });
  await new DrizzleSpecIdRepository(connection.db).add(cup, SpecIdChange.created(cup, randomUUID()), null);
});
afterAll(() => connection.close());

describe('DrizzleQuoteSuggestionRepository (ADR 0035)', () => {
  it('keeps a quotation with its Spec ID, its new manufacturer as named, and its trail', async () => {
    const step = suggested({ manufacturer: { kind: 'new', name: 'Invented Cups Co', country: 'Elsewhere' }, values: VALUES });
    await repository.add(step);

    const record = await repository.findById(step.suggestion.id);
    expect(record).toMatchObject({
      suggestedByName: 'Ada Invented',
      decidedByName: null,
      specName: 'Invented PP cup',
      manufacturerName: 'Invented Cups Co',
      manufacturerCountry: 'Elsewhere',
    });
    expect(record?.suggestion.proposal).toEqual(step.suggestion.proposal);
    expect((await repository.events(step.suggestion.id)).map(({ event, byName }) => [event.kind, byName])).toEqual([['suggested', 'Ada Invented']]);
    expect(await repository.countWaitingNotSuggestedBy(BEN)).toBe(1);
    expect(await repository.countWaitingNotSuggestedBy(ADA)).toBe(0);
  });

  it('approves in one transaction: the decision, a manufacturer found or added by name, and the quote', async () => {
    const step = suggested({ manufacturer: { kind: 'new', name: 'Invented Cups Co', country: 'Elsewhere' }, values: VALUES });
    await repository.add(step);
    const quoteId = randomUUID();
    const approved = step.suggestion.approve(BEN, AT, randomUUID(), quoteId);
    if (!approved.ok) throw approved.error;

    expect(await repository.approve(approved.value, 1, { quoteId, newManufacturerId: randomUUID(), at: AT })).toEqual({ ok: true, value: undefined });

    const [quoted] = await sourcing.quotesOf(CUP_ID);
    expect(quoted).toMatchObject({ quote: { id: quoteId, suggestionId: step.suggestion.id, values: { fobPerUnit: '$0.0100' } }, manufacturer: { name: 'Invented Cups Co', country: 'Elsewhere' } });
    expect((await repository.findById(step.suggestion.id))?.suggestion).toMatchObject({ state: 'approved', quoteId });
    // Decided once: a second approval from the same version moves nothing.
    expect(await repository.approve(approved.value, 1, { quoteId: randomUUID(), newManufacturerId: randomUUID(), at: AT })).toMatchObject({
      ok: false,
      error: { code: 'QUOTE_SUGGESTION_CHANGED' },
    });
    expect(await sourcing.quotesOf(CUP_ID)).toHaveLength(1);
  });

  it('joins a manufacturer of the same name, keeping its country, and outlives an import', async () => {
    await sourcing.replaceQuotes([
      { id: randomUUID(), specId: CUP_ID, manufacturer: { id: randomUUID(), name: 'Invented Cups Co', country: 'Nowhere' }, values: VALUES, importedAt: AT },
    ]);
    const step = suggested({ manufacturer: { kind: 'new', name: ' invented cups co ', country: 'Elsewhere' }, values: VALUES });
    await repository.add(step);
    const quoteId = randomUUID();
    const approved = step.suggestion.approve(BEN, AT, randomUUID(), quoteId);
    if (!approved.ok) throw approved.error;
    await repository.approve(approved.value, 1, { quoteId, newManufacturerId: randomUUID(), at: AT });

    expect((await sourcing.manufacturers()).map(({ name, country }) => [name, country])).toEqual([['Invented Cups Co', 'Nowhere']]);

    await sourcing.replaceQuotes([]);
    expect((await sourcing.quotesOf(CUP_ID)).map(({ quote }) => quote.id)).toEqual([quoteId]);
  });

  it('saves an edit from the version read only, and lists waiting oldest first, one Spec ID\'s or all', async () => {
    const maker = randomUUID();
    await sourcing.replaceQuotes([{ id: randomUUID(), specId: CUP_ID, manufacturer: { id: maker, name: 'Invented Moulding Ltd', country: null }, values: VALUES, importedAt: AT }]);
    const [existing] = await sourcing.manufacturers();
    const step = suggested({ manufacturer: { kind: 'existing', id: existing?.id ?? '' }, values: VALUES });
    await repository.add(step);
    const edited = step.suggestion.edit(ADA, { ...step.suggestion.proposal, values: { ...VALUES, fobPerUnit: '$0.0120' } }, AT, randomUUID());
    if (!edited.ok) throw edited.error;

    expect(await repository.save(edited.value, 2)).toMatchObject({ ok: false, error: { code: 'QUOTE_SUGGESTION_CHANGED' } });
    expect(await repository.save(edited.value, 1)).toEqual({ ok: true, value: undefined });

    const listed = await repository.list('waiting', CUP_ID);
    expect(listed.map((record) => [record.manufacturerName, record.suggestion.version, record.suggestion.proposal.values.fobPerUnit])).toEqual([
      ['Invented Moulding Ltd', 2, '$0.0120'],
    ]);
    expect(await repository.list('waiting', randomUUID())).toEqual([]);
    expect(await repository.list('decided')).toEqual([]);
  });
});
