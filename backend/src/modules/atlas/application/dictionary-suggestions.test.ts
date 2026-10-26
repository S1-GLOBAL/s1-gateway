import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import {
  InvalidSuggestionError,
  SuggestionChangedError,
  SuggestionDecidedError,
  SuggestionNotAllowedError,
  SuggestionNotFoundError,
} from '../domain/suggestions/suggestion.errors.js';
import type { Proposal } from '../domain/suggestions/proposal.js';
import { CountWaitingSuggestions } from './count-waiting-suggestions.js';
import { EditDictionarySuggestion } from './edit-dictionary-suggestion.js';
import { GetDictionary } from './get-dictionary.js';
import { GetDictionarySuggestion } from './get-dictionary-suggestion.js';
import { GetDictionaryUsage } from './get-dictionary-usage.js';
import { ListDictionarySuggestions } from './list-dictionary-suggestions.js';
import { SaveSpecId } from './save-spec-id.js';
import { SuggestDictionaryChange } from './suggest-dictionary-change.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { InMemorySuggestionRepository } from './testing/in-memory-suggestion-repository.js';
import { WithdrawDictionarySuggestion } from './withdraw-dictionary-suggestion.js';

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const NOW = new Date('2026-10-27T08:00:00.000Z');
const NEW_MATERIAL: Proposal = { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null };

function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const suggestions = new InMemorySuggestionRepository();
  for (const person of [ADA, BEN]) {
    specIds.nameSaver(person.id, person.fullName);
    suggestions.nameAccount(person.id, person.fullName);
  }
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  return {
    dictionaries,
    specIds,
    suggest: new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids),
    edit: new EditDictionarySuggestion(dictionaries, specIds, suggestions, clock, ids),
    withdraw: new WithdrawDictionarySuggestion(suggestions, clock, ids),
    list: new ListDictionarySuggestions(suggestions),
    get: new GetDictionarySuggestion(dictionaries, suggestions, specIds),
    count: new CountWaitingSuggestions(suggestions),
    usage: new GetDictionaryUsage(specIds),
    save: new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), clock, ids),
  };
}

async function suggested(context: ReturnType<typeof setup>, by = ADA, code = 'azz') {
  const result = await context.suggest.execute({ target: { slot: 'material', code }, proposal: NEW_MATERIAL, by });
  if (!result.ok) throw result.error;
  return result.value;
}

describe('SuggestDictionaryChange', () => {
  it('keeps a waiting suggestion, tidied, and changes nothing in the dictionary', async () => {
    const context = setup();
    const before = await new GetDictionary(context.dictionaries).execute();

    const suggestion = await suggested(context);

    expect(suggestion).toMatchObject({
      kind: 'add',
      slot: 'material',
      code: 'AZZ',
      state: 'waiting',
      version: 1,
      suggestedBy: { id: ADA.id, fullName: 'Ada Invented' },
      suggestedAt: NOW.toISOString(),
      decidedBy: null,
      changeNumber: null,
    });
    expect(await new GetDictionary(context.dictionaries).execute()).toEqual(before);
  });

  it('refuses a proposal that breaks a rule, keeping nothing', async () => {
    const context = setup();
    const result = await context.suggest.execute({ target: { slot: 'material', code: 'APS' }, proposal: NEW_MATERIAL, by: ADA });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidSuggestionError);
    expect(await context.list.execute({ state: 'waiting' })).toEqual([]);
  });

  it('checks a delete against how many saved Spec IDs use the option', async () => {
    const context = setup();
    const saved = await context.save.execute({
      name: 'Invented lid',
      facts: { productType: 'BLD', material: 'APS', shape: 'RD' },
      savedBy: ADA,
    });
    if (!saved.ok) throw saved.error;

    const result = await context.suggest.execute({
      target: { slot: 'material', code: 'APS' },
      proposal: { kind: 'delete', replacement: null },
      by: ADA,
    });
    expect(!result.ok && (result.error as InvalidSuggestionError).issues.replacement).toEqual(['Pick what those Spec IDs become.']);
    expect(await context.usage.execute({ slot: 'material', code: 'aps' })).toEqual({ ok: true, value: 1 });
  });
});

describe('EditDictionarySuggestion', () => {
  it("replaces the suggester's proposal, raising its version, with the edit in its trail", async () => {
    const context = setup();
    const { id } = await suggested(context);

    const result = await context.edit.execute({
      id,
      target: { slot: 'material', code: 'AZZ' },
      proposal: { ...NEW_MATERIAL, meaning: 'Polymer, invented again' },
      version: 1,
      by: ADA,
    });

    expect(result.ok && result.value).toMatchObject({ version: 2, proposal: { meaning: 'Polymer, invented again' } });
    const detail = await context.get.execute({ id });
    expect(detail.ok && detail.value.events.map((event) => event.kind)).toEqual(['suggested', 'edited']);
    expect(detail.ok && detail.value.events[1]).toMatchObject({
      by: { fullName: 'Ada Invented' },
      proposalBefore: NEW_MATERIAL,
      proposalAfter: { meaning: 'Polymer, invented again' },
    });
  });

  it("refuses someone else's edit before looking at what it asks", async () => {
    const context = setup();
    const { id } = await suggested(context);
    const result = await context.edit.execute({
      id,
      target: { slot: 'material', code: 'AZZ' },
      proposal: { ...NEW_MATERIAL, meaning: '' },
      version: 1,
      by: BEN,
    });
    expect(!result.ok && result.error).toBeInstanceOf(SuggestionNotAllowedError);
  });

  it('refuses changing its kind, list or code, an edit from an old version, and an unknown suggestion', async () => {
    const context = setup();
    const { id } = await suggested(context);
    const moved = await context.edit.execute({ id, target: { slot: 'material', code: 'AZY' }, proposal: NEW_MATERIAL, version: 1, by: ADA });
    expect(!moved.ok && (moved.error as InvalidSuggestionError).issues.kind).toEqual([
      "A suggestion's kind, list and code can't change. Withdraw it and suggest again.",
    ]);

    await context.edit.execute({ id, target: { slot: 'material', code: 'AZZ' }, proposal: NEW_MATERIAL, version: 1, by: ADA });
    const stale = await context.edit.execute({ id, target: { slot: 'material', code: 'AZZ' }, proposal: NEW_MATERIAL, version: 1, by: ADA });
    expect(!stale.ok && stale.error).toBeInstanceOf(SuggestionChangedError);

    const unknown = await context.edit.execute({
      id: '00000000-0000-4000-8000-0000000000ff',
      target: { slot: 'material', code: 'AZZ' },
      proposal: NEW_MATERIAL,
      version: 1,
      by: ADA,
    });
    expect(!unknown.ok && unknown.error).toBeInstanceOf(SuggestionNotFoundError);
  });
});

describe('WithdrawDictionarySuggestion', () => {
  it('lets the suggester withdraw it, once, and moves it to the decided list', async () => {
    const context = setup();
    const { id } = await suggested(context);

    const withdrawn = await context.withdraw.execute({ id, by: ADA });
    expect(withdrawn.ok && withdrawn.value).toMatchObject({ state: 'withdrawn', decidedAt: NOW.toISOString(), decidedBy: null });
    expect(await context.list.execute({ state: 'waiting' })).toEqual([]);
    expect((await context.list.execute({ state: 'decided' })).map((s) => s.id)).toEqual([id]);

    const again = await context.withdraw.execute({ id, by: ADA });
    expect(!again.ok && again.error).toBeInstanceOf(SuggestionDecidedError);
  });

  it("refuses someone else's withdrawal", async () => {
    const context = setup();
    const { id } = await suggested(context);
    const result = await context.withdraw.execute({ id, by: BEN });
    expect(!result.ok && result.error).toBeInstanceOf(SuggestionNotAllowedError);
  });
});

describe('CountWaitingSuggestions', () => {
  it('counts nothing for staff, and for an admin every waiting suggestion but their own', async () => {
    const context = setup();
    await suggested(context, ADA, 'AZA');
    await suggested(context, BEN, 'AZB');
    expect(await context.count.execute({ by: ADA })).toBe(0);
    expect(await context.count.execute({ by: BEN })).toBe(1);
    expect(await context.count.execute({ by: { ...ADA, isAdmin: true } })).toBe(1);
  });
});

describe('GetDictionaryUsage', () => {
  it('refuses a list that is not in the dictionary, and counts 0 for a code of the wrong width', async () => {
    const context = setup();
    const refused = await context.usage.execute({ slot: 'height', code: 'AB' });
    expect(!refused.ok && refused.error).toBeInstanceOf(InvalidSuggestionError);
    expect(await context.usage.execute({ slot: 'material', code: 'A' })).toEqual({ ok: true, value: 0 });
  });

  it('counts 0 for a marker or a wildcard, which no option can be', async () => {
    const context = setup();
    // A lid has no capacity: it holds the marker X there.
    const saved = await context.save.execute({
      name: 'Invented lid',
      facts: { productType: 'BLD', material: 'APS', shape: 'RD' },
      savedBy: ADA,
    });
    if (!saved.ok) throw saved.error;
    for (const code of ['X', 'Y', '%', '_']) {
      expect(await context.usage.execute({ slot: 'capacity', code })).toEqual({ ok: true, value: 0 });
    }
  });
});
