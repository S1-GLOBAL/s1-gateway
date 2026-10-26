import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { CryptoIdGenerator } from '../../../shared/infrastructure/crypto-id-generator.js';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { ApproveDictionarySuggestion } from '../application/approve-dictionary-suggestion.js';
import { SaveSpecId } from '../application/save-spec-id.js';
import { SuggestDictionaryChange } from '../application/suggest-dictionary-change.js';
import { UpdateSpecId } from '../application/update-spec-id.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import type { DictionaryChangeStore } from '../domain/suggestions/dictionary-change-store.js';
import { DictionaryMovedOnError, SpecIdMovedOnError } from '../domain/suggestions/suggestion.errors.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';
import { DrizzleDictionaryChangeStore } from './drizzle-dictionary-change-store.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';
import { DrizzleSuggestionRepository } from './drizzle-suggestion-repository.js';

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

async function lidAndRename() {
  const sourcing = new DrizzleSourcingRepository(connection.db);
  const saved = await new SaveSpecId(dictionaries, specIds, sourcing, clock, ids).execute({
    name: 'Lid 90',
    facts: { productType: 'BLD', material: 'APS', shape: 'RD', profile: 'DM' },
    savedBy: ADA,
  });
  if (!saved.ok) throw saved.error;
  const suggestion = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
    target: { slot: 'material', code: 'APS' },
    proposal: { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null },
    by: ADA,
  });
  if (!suggestion.ok) throw suggestion.error;
  return { saved: saved.value, suggestion: suggestion.value, update: new UpdateSpecId(dictionaries, specIds, sourcing, clock, ids) };
}

const changeCount = async () => (await connection.db.select({ n: count() }).from(atlasDictionaryChanges))[0]?.n;

describe('DrizzleDictionaryChangeStore', () => {
  it('rolls back everything, the dictionary included, when a Spec ID moved on mid-approval', async () => {
    const { saved, suggestion, update } = await lidAndRename();
    const racing = {
      apply: async (plan: Parameters<typeof store.apply>[0]) => {
        await update.execute({ id: saved.id, name: 'Lid 90, renamed', facts: { productType: 'BLD', material: 'APS', shape: 'RD', profile: 'DM' }, version: 1, updatedBy: ADA });
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
    expect(dictionary?.meaningOf('material', 'APS')).toBe('Polymer, PS (polystyrene)');
    expect(dictionary?.renames()).toEqual([]);
    expect(await changeCount()).toBe(0);
    expect((await suggestions.findById(suggestion.id))?.suggestion.state).toBe('waiting');
  });

  it('refuses a plan made before another approval landed', async () => {
    const { suggestion } = await lidAndRename();
    const other = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
      target: { slot: 'material', code: 'AZZ' },
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

  it('writes the renames and search words an approval gives, read back with the dictionary', async () => {
    const { suggestion } = await lidAndRename();
    const words = await new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids).execute({
      target: { slot: 'material', code: 'APP' },
      proposal: { kind: 'edit', newCode: null, meaning: null, searchWords: ['polypropylene', 'pp plastic'] },
      by: ADA,
    });
    if (!words.ok) throw words.error;
    const approve = new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids);
    await approve.execute({ id: suggestion.id, version: 1, by: BEN });
    await approve.execute({ id: words.value.id, version: 1, by: BEN });

    const dictionary = await dictionaries.get(CURRENT_RELEASE);
    expect(dictionary?.live('material', 'APS')).toBe('APZ');
    expect(dictionary?.searchWordsOf('material', 'APP')).toEqual(['polypropylene', 'pp plastic']);
    expect(dictionary?.change?.number).toBe(2);
  });
});
