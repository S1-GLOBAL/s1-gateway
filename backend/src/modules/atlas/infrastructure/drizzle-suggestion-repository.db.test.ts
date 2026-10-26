import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import type { Proposal } from '../domain/suggestions/proposal.js';
import { SuggestionChangedError } from '../domain/suggestions/suggestion.errors.js';
import { Suggestion } from '../domain/suggestions/suggestion.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';
import { DrizzleSuggestionRepository } from './drizzle-suggestion-repository.js';
import { toSuggestionRow } from './suggestion.mapper.js';

const connection = connectTestDatabase();
const repository = new DrizzleSuggestionRepository(connection.db);

const ADA = '00000000-0000-4000-8000-0000000000aa';
const BEN = '00000000-0000-4000-8000-0000000000bb';
const ADD: Proposal = { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null };

function suggestion(id: string, by: string, at: string, code = 'AZZ') {
  return Suggestion.suggest({
    id,
    eventId: id.replace(/^0/, '9'),
    target: { slot: 'material', code },
    proposal: ADD,
    by,
    at: new Date(at),
  });
}

beforeEach(async () => {
  await resetTables(connection.db);
  for (const [id, email, fullName] of [
    [ADA, 'ada@sourceone.global', 'Ada Invented'],
    [BEN, 'ben@sourceone.global', 'Ben Invented'],
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

describe('DrizzleSuggestionRepository', () => {
  it('round-trips a suggestion, its proposal and its trail, with names', async () => {
    const step = suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z');
    await repository.add(step);

    const found = await repository.findById(step.suggestion.id);
    expect(found?.suggestedByName).toBe('Ada Invented');
    expect(found?.decidedByName).toBeNull();
    expect(found?.suggestion.proposal).toEqual(ADD);
    expect(found?.suggestion.target).toEqual({ slot: 'material', code: 'AZZ' });
    expect(found?.suggestion.version).toBe(1);

    const trail = await repository.events(step.suggestion.id);
    expect(trail).toEqual([{ event: step.event, byName: 'Ada Invented' }]);
  });

  it('saves an edit over the version it was made from, and records it', async () => {
    const step = suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z');
    await repository.add(step);
    const made = step.suggestion;
    const edited = made.edit(ADA, { ...ADD, meaning: 'Polymer, renamed' }, new Date('2026-10-27T09:00:00.000Z'), '03333333-3333-4333-8333-333333333333');
    if (!edited.ok) throw edited.error;

    expect(await repository.save(edited.value, 1)).toEqual({ ok: true, value: undefined });
    expect((await repository.findById(made.id))?.suggestion.version).toBe(2);
    expect((await repository.events(made.id)).map((record) => record.event.kind)).toEqual(['suggested', 'edited']);
  });

  it('refuses to save over a version that moved on, or a suggestion that no longer waits, and records nothing', async () => {
    const step = suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z');
    await repository.add(step);
    const withdrawn = step.suggestion.withdraw(ADA, new Date('2026-10-27T09:00:00.000Z'), '03333333-3333-4333-8333-333333333333');
    if (!withdrawn.ok) throw withdrawn.error;
    await repository.save(withdrawn.value, 1);

    const again = step.suggestion.edit(ADA, ADD, new Date('2026-10-27T10:00:00.000Z'), '04444444-4444-4444-8444-444444444444');
    if (!again.ok) throw again.error;
    const saved = await repository.save(again.value, 1);
    expect(!saved.ok && saved.error).toBeInstanceOf(SuggestionChangedError);
    expect((await repository.events(step.suggestion.id)).map((record) => record.event.kind)).toEqual(['suggested', 'withdrawn']);
  });

  it('lists waiting suggestions oldest first, and decided ones latest decision first', async () => {
    const first = suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z', 'AZA');
    const second = suggestion('02222222-2222-4222-8222-222222222222', BEN, '2026-10-27T09:00:00.000Z', 'AZB');
    const third = suggestion('05555555-5555-4555-8555-555555555555', BEN, '2026-10-27T10:00:00.000Z', 'AZC');
    for (const step of [third, first, second]) await repository.add(step);
    const withdrawn = second.suggestion.withdraw(BEN, new Date('2026-10-27T11:00:00.000Z'), '03333333-3333-4333-8333-333333333333');
    if (!withdrawn.ok) throw withdrawn.error;
    await repository.save(withdrawn.value, 1);

    expect((await repository.list('waiting')).map((record) => record.suggestion.target.code)).toEqual(['AZA', 'AZC']);
    expect((await repository.list('decided')).map((record) => record.suggestion.target.code)).toEqual(['AZB']);
  });

  it('refuses a reason on a suggestion that was not rejected', async () => {
    const row = toSuggestionRow(suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z').suggestion);
    await expect(connection.db.insert(atlasDictionarySuggestions).values({ ...row, reason: 'Duplicate' })).rejects.toThrow();
    await expect(
      connection.db
        .insert(atlasDictionarySuggestions)
        .values({ ...row, state: 'withdrawn', decidedAt: new Date('2026-10-27T09:00:00.000Z'), reason: 'Duplicate' }),
    ).rejects.toThrow();
  });

  it('counts the waiting suggestions someone did not make', async () => {
    await repository.add(suggestion('01111111-1111-4111-8111-111111111111', ADA, '2026-10-27T08:00:00.000Z', 'AZA'));
    await repository.add(suggestion('02222222-2222-4222-8222-222222222222', BEN, '2026-10-27T09:00:00.000Z', 'AZB'));
    await repository.add(suggestion('05555555-5555-4555-8555-555555555555', BEN, '2026-10-27T10:00:00.000Z', 'AZC'));
    expect(await repository.countWaitingNotSuggestedBy(ADA)).toBe(2);
    expect(await repository.countWaitingNotSuggestedBy(BEN)).toBe(1);
  });
});
