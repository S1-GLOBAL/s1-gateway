import { randomUUID } from 'node:crypto';
import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import type { QuoteValues } from '../domain/sourcing/quote.js';
import type { QuoteToRecord } from '../domain/sourcing/sourcing-repository.js';
import { SpecId } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasQuotes } from './atlas-quotes.table.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleSourcingRepository(connection.db);

const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const CUP_ID = '00000000-0000-4000-8000-00000000c001';
const IMPORTED_AT = new Date('2026-10-23T08:00:00.000Z');

/** Invented values: never a Source One price (ADR 0027). */
const VALUES: QuoteValues = {
  itemName: 'Invented PP cup',
  fobPerUnit: '$0.0123',
  fobPerCase: '$12.30',
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: '7',
  productionLeadTime: '30 days',
};

function quote(manufacturer: string, country: string | null, values: Partial<QuoteValues> = {}): QuoteToRecord {
  return {
    id: randomUUID(),
    specId: CUP_ID,
    manufacturer: { id: randomUUID(), name: manufacturer, country },
    values: { ...VALUES, ...values },
    importedAt: IMPORTED_AT,
  };
}

const manufacturerCount = async () => (await connection.db.select({ n: count() }).from(atlasManufacturers))[0]?.n;
const quoteCount = async () => (await connection.db.select({ n: count() }).from(atlasQuotes))[0]?.n;

beforeEach(async () => {
  await resetTables(connection.db);
  await connection.db.insert(accountsTable).values({
    id: SAVER_ID,
    email: 'saver@sourceone.global',
    fullName: 'Ada Invented',
    passwordHash: 'hash',
    status: 'approved',
    createdAt: new Date('2026-10-14T08:00:00.000Z'),
  });
  const built = SpecId.build({ productType: 'CUP', material: 'APP' }, s2Dictionary());
  if (!built.ok) throw new Error('setup failed');
  const cup = SavedSpecId.restore({
    id: CUP_ID,
    specId: built.value,
    name: 'Invented PP cup',
    dictionaryRelease: 'S2 0.1.0',
    savedBy: SAVER_ID,
    savedAt: IMPORTED_AT,
  });
  await new DrizzleSpecIdRepository(connection.db).add(cup, SpecIdChange.created(cup, randomUUID()));
});
afterAll(() => connection.close());

describe('DrizzleSourcingRepository', () => {
  it('keeps two quotes for one manufacturer, and the manufacturer once its quotes are gone', async () => {
    await repository.replaceQuotes([quote('Acme Packaging', 'Atlantis'), quote('Acme Packaging', 'Atlantis', { fobPerUnit: '$0.0150' })]);

    const quotes = await repository.quotesOf(CUP_ID);
    expect(quotes.map(({ quote: { values } }) => values.fobPerUnit).sort()).toEqual(['$0.0123', '$0.0150']);
    expect(new Set(quotes.map(({ manufacturer }) => manufacturer.id)).size).toBe(1);
    expect(quotes[0]?.quote.values).toMatchObject({ fobTotal: null, productionLeadTime: '30 days' });

    await connection.db.delete(atlasQuotes);
    expect(await manufacturerCount()).toBe(1);
  });

  it('takes " Acme Packaging " and "acme packaging" for one manufacturer, named as first written', async () => {
    await repository.replaceQuotes([quote(' Acme Packaging ', null), quote('acme packaging', null)]);

    const quotes = await repository.quotesOf(CUP_ID);
    expect(await manufacturerCount()).toBe(1);
    expect(quotes.map(({ manufacturer }) => manufacturer.name)).toEqual(['Acme Packaging', 'Acme Packaging']);
  });

  it('replaces the quotes, not adds to them, when given the same rows twice', async () => {
    const rows = [quote('Acme Packaging', 'Atlantis'), quote('Borealis Boxes', 'Lemuria')];
    await repository.replaceQuotes(rows);
    const first = await repository.quotesOf(CUP_ID);

    await repository.replaceQuotes(rows.map((row) => ({ ...row, id: randomUUID(), manufacturer: { ...row.manufacturer, id: randomUUID() } })));

    expect(await quoteCount()).toBe(2);
    expect(await manufacturerCount()).toBe(2);
    const second = await repository.quotesOf(CUP_ID);
    expect(second.map(({ manufacturer }) => manufacturer.id)).toEqual(first.map(({ manufacturer }) => manufacturer.id));
  });

  it("updates a manufacturer's country when a row gives one, and keeps it when a row gives none", async () => {
    await repository.replaceQuotes([quote('Acme Packaging', null)]);
    await repository.replaceQuotes([quote('Acme Packaging', 'Atlantis')]);
    expect((await repository.quotesOf(CUP_ID))[0]?.manufacturer.country).toBe('Atlantis');

    await repository.replaceQuotes([quote('Acme Packaging', null)]);
    expect((await repository.quotesOf(CUP_ID))[0]?.manufacturer.country).toBe('Atlantis');
  });

  it('leaves no quote, and every manufacturer, when given none', async () => {
    await repository.replaceQuotes([quote('Acme Packaging', 'Atlantis')]);

    await repository.replaceQuotes([]);

    expect(await quoteCount()).toBe(0);
    expect(await manufacturerCount()).toBe(1);
  });
});
