import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { CryptoIdGenerator } from '../../../shared/infrastructure/crypto-id-generator.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { ApproveDictionarySuggestion } from '../application/approve-dictionary-suggestion.js';
import { SaveSpecId } from '../application/save-spec-id.js';
import { SuggestDictionaryChange } from '../application/suggest-dictionary-change.js';
import { UpdateSpecId } from '../application/update-spec-id.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { SpecIdFactsInput } from '../domain/spec-id.js';
import type { DictionaryChangeStore } from '../domain/suggestions/dictionary-change-store.js';
import { DictionaryMovedOnError, SpecIdMovedOnError } from '../domain/suggestions/suggestion.errors.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';
import { atlasDictionaryValues } from './atlas-dictionary.table.js';
import { DrizzleDictionaryChangeStore } from './drizzle-dictionary-change-store.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';
import { DrizzleSuggestionRepository } from './drizzle-suggestion-repository.js';
import { MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE } from '../domain/options.js';

const connection = connectTestDatabase();
const dictionaries = new DrizzleDictionaryRepository(connection.db);
const specIds = new DrizzleSpecIdRepository(connection.db);
const suggestions = new DrizzleSuggestionRepository(connection.db);
const store = new DrizzleDictionaryChangeStore(connection.db);
const clock = new FixedClock(new Date('2026-10-27T08:00:00.000Z'));
const ids = new CryptoIdGenerator();

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };

beforeEach(async () => {
  await resetTables(connection.db);
  for (const [id, email, fullName] of [
    [ADA.id, 'ada@sourceone.global', ADA.fullName],
    [BEN.id, 'ben@sourceone.global', BEN.fullName],
  ] as const) {
    await connection.db.insert(accountsTable).values({
      id,
      email,
      fullName,
      passwordHash: 'hash',
      status: 'approved',
      createdAt: new Date('2026-10-14T08:00:00.000Z'),
    });
  }
});
afterAll(() => connection.close());

/** A saved lid of PS, and a suggestion to delete PS for PP: an approval that rewrites a saved Spec ID. */
async function lidAndDelete() {
  const sourcing = new DrizzleSourcingRepository(connection.db);
  const saved = await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({
    name: 'Lid 90',
    facts: { productType: PRODUCT_TYPE.bowlLid, material: MATERIAL.ps, shape: SHAPE.round, profile: PROFILE.dome },
    savedBy: ADA,
  });
  if (!saved.ok) throw saved.error;
  const suggestion = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
    target: { slot: 'material', code: MATERIAL.ps },
    proposal: { kind: 'delete', replacement: MATERIAL.pp },
    by: ADA,
  });
  if (!suggestion.ok) throw suggestion.error;
  return { saved: saved.value, suggestion: suggestion.value, update: new UpdateSpecId(dictionaries, specIds, sourcing, clock, ids) };
}

const changeCount = async () => (await connection.db.select({ n: count() }).from(atlasDictionaryChanges))[0]?.n;

/**
 * `db`, but the first read of the latest change waits for `meanwhile` to run,
 * after any read of the values already under way: a dictionary read that
 * straddles another approval's commit.
 */
function straddling(db: Database, meanwhile: () => Promise<unknown>): Database {
  let valuesRead: Promise<unknown> | undefined;
  let ran = false;
  // Awaiting a Drizzle query runs its `execute`.
  type Query = { execute: (...args: unknown[]) => Promise<unknown> };
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== 'select') return Reflect.get(target, property, receiver);
      return (...args: Parameters<Database['select']>) => {
        const builder = target.select(...args);
        const from = builder.from.bind(builder);
        builder.from = ((table: unknown) => {
          const query = from(table as never) as unknown as Query;
          const execute = query.execute.bind(query);
          if (table === atlasDictionaryValues) query.execute = (...given) => (valuesRead = execute(...given));
          if (table === atlasDictionaryChanges && !ran) {
            ran = true;
            query.execute = async (...given) => {
              await valuesRead;
              await meanwhile();
              return execute(...given);
            };
          }
          return query;
        }) as never;
        return builder;
      };
    },
  });
}

describe('DrizzleDictionaryChangeStore', () => {
  it('rolls back everything, the dictionary included, when a Spec ID moved on mid-approval', async () => {
    const { saved, suggestion, update } = await lidAndDelete();
    const racing = {
      apply: async (plan: Parameters<typeof store.apply>[0]) => {
        await update.execute({ id: saved.id, name: 'Lid 90, renamed', facts: { productType: PRODUCT_TYPE.bowlLid, material: MATERIAL.ps, shape: SHAPE.round, profile: PROFILE.dome }, version: 1, updatedBy: ADA });
        return store.apply(plan);
      },
    };

    const result = await new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, racing, clock, ids).execute({
      id: suggestion.id,
      version: 1,
      by: BEN,
    });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdMovedOnError);
    const dictionary = await dictionaries.get(CURRENT_RELEASE);
    expect(dictionary?.meaningOf('material', MATERIAL.ps)).toBe('Polymer, PS (polystyrene)');
    expect(dictionary?.retired()).toEqual([]);
    expect(await changeCount()).toBe(0);
    expect((await suggestions.findById(suggestion.id))?.suggestion.state).toBe('waiting');
  });

  it('refuses a plan made before another approval landed', async () => {
    const { suggestion } = await lidAndDelete();
    const other = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
      target: { slot: 'material', code: '' },
      proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null },
      by: ADA,
    });
    if (!other.ok) throw other.error;
    const approve = (via: DictionaryChangeStore) => new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, via, clock, ids);
    let landed = false;
    const late = {
      apply: async (plan: Parameters<typeof store.apply>[0]) => {
        if (!landed) {
          landed = true;
          await approve(store).execute({ id: other.value.id, version: 1, by: BEN });
        }
        return store.apply(plan);
      },
    };

    const result = await approve(late).execute({ id: suggestion.id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(DictionaryMovedOnError);
    expect(await changeCount()).toBe(1);
  });

  it('never writes a dictionary read before another approval landed as if it came after', async () => {
    const { suggestion } = await lidAndDelete();
    const other = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
      target: { slot: 'material', code: '' },
      proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null },
      by: ADA,
    });
    if (!other.ok) throw other.error;
    const deletion = () =>
      new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids).execute({ id: suggestion.id, version: 1, by: BEN });
    const reading = new DrizzleDictionaryRepository(straddling(connection.db, deletion));

    const result = await new ApproveDictionarySuggestion(reading, specIds, suggestions, store, clock, ids).execute({
      id: other.value.id,
      version: 1,
      by: BEN,
    });

    // Either refused as out of date, or made from the dictionary the deletion left: never the deletion undone.
    const dictionary = await dictionaries.get(CURRENT_RELEASE);
    expect(dictionary?.live('material', MATERIAL.ps)).toBeUndefined();
    expect(dictionary?.retired().map(({ number }) => number)).toEqual([4]);
    if (result.ok) expect(dictionary?.meaningOf('material', '39')).toBe('Polymer, invented');
    else expect(result.error).toBeInstanceOf(DictionaryMovedOnError);
  });

  it('writes the retired number and search words an approval gives, read back with the dictionary', async () => {
    const { suggestion } = await lidAndDelete();
    const words = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
      target: { slot: 'material', code: MATERIAL.pp },
      proposal: { kind: 'edit', newCode: null, meaning: null, searchWords: ['polypropylene', 'pp plastic'] },
      by: ADA,
    });
    if (!words.ok) throw words.error;
    const approve = new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids);
    await approve.execute({ id: suggestion.id, version: 1, by: BEN });
    await approve.execute({ id: words.value.id, version: 1, by: BEN });

    const dictionary = await dictionaries.get(CURRENT_RELEASE);
    // A deleted option keeps its old letters, so a dotted code written with them still reads (ADR 0033).
    expect(dictionary?.retired()).toEqual([
      { slot: 'material', number: 4, code: MATERIAL.ps, meaning: 'Polymer, PS (polystyrene)', changeNumber: 1, legacyCode: 'APS' },
    ]);
    expect(dictionary?.fromLetters('material', 'APS')).toBe(MATERIAL.ps);
    expect(dictionary?.searchWordsOf('material', MATERIAL.pp)).toEqual(['polypropylene', 'pp plastic']);
    expect(dictionary?.change?.number).toBe(2);
  });
});

describe('Spec IDs written while an approval runs', () => {
  const lid = (material: string): SpecIdFactsInput => ({
    productType: PRODUCT_TYPE.bowlLid,
    material,
    shape: SHAPE.round,
    profile: PROFILE.dome,
    topDiameter: { value: '95', unit: 'mm' },
  });
  const sourcing = new DrizzleSourcingRepository(connection.db);

  /** The dictionary as it is, but the first read lets `meanwhile` land first: a write built from it is out of date. */
  function readBefore(meanwhile: () => Promise<unknown>): DictionaryRepository {
    let landed = false;
    return {
      get: async (release) => {
        const dictionary = await dictionaries.get(release);
        if (!landed) {
          landed = true;
          await meanwhile();
        }
        return dictionary;
      },
    };
  }

  it('refuses an approval when a Spec ID came to hold the option meanwhile, writing nothing', async () => {
    const { suggestion } = await lidAndDelete();
    const racing = {
      apply: async (plan: Parameters<typeof store.apply>[0]) => {
        await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({ name: 'Lid 95', facts: lid(MATERIAL.ps), savedBy: ADA });
        return store.apply(plan);
      },
    };

    const result = await new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, racing, clock, ids).execute({
      id: suggestion.id,
      version: 1,
      by: BEN,
    });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdMovedOnError);
    expect((await dictionaries.get(CURRENT_RELEASE))?.meaningOf('material', MATERIAL.ps)).toBe('Polymer, PS (polystyrene)');
    expect(await changeCount()).toBe(0);
  });

  it('checks a save again against the dictionary an approval left while it was being made', async () => {
    const { suggestion } = await lidAndDelete();
    const approve = () => new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids).execute({ id: suggestion.id, version: 1, by: BEN });

    const result = await new SaveSpecId(readBefore(approve), specIds, sourcing, clock, ids).execute({ name: 'Lid 95', facts: lid(MATERIAL.ps), savedBy: ADA });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await specIds.usageOf('material', MATERIAL.ps)).toBe(0);
  });

  it('checks a change again against the dictionary an approval left while it was being made', async () => {
    const { suggestion } = await lidAndDelete();
    const pp = await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({ name: 'PP lid', facts: lid(MATERIAL.pp), savedBy: ADA });
    if (!pp.ok) throw pp.error;
    const approve = () => new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids).execute({ id: suggestion.id, version: 1, by: BEN });

    const result = await new UpdateSpecId(readBefore(approve), specIds, sourcing, clock, ids).execute({
      id: pp.value.id,
      name: 'PP lid',
      facts: lid(MATERIAL.ps),
      version: 1,
      updatedBy: ADA,
    });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await specIds.usageOf('material', MATERIAL.ps)).toBe(0);
  });
});
